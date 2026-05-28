import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { shopItems } from '../../config/shop/items.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SHOP_ITEMS = shopItems;

export default {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy an item from the shop')
        .addStringOption(option =>
            option
                .setName('item_id')
                .setDescription('ID of the item to buy')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('quantity')
                .setDescription('Quantity to buy (default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {

        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        const itemId = interaction.options.getString('item_id').toLowerCase();
        const quantity = interaction.options.getInteger('quantity') || 1;

        const item = SHOP_ITEMS.find(i => i.id === itemId);

        // Item check
        if (!item) {
            throw createError(
                'Item not found',
                ErrorTypes.VALIDATION,
                `❌ The item ID \`${itemId}\` does not exist.`,
                { itemId }
            );
        }

        // Quantity check
        if (quantity < 1) {
            throw createError(
                'Invalid quantity',
                ErrorTypes.VALIDATION,
                '❌ Quantity must be at least 1.',
                { quantity }
            );
        }

        // Role item only buy once
        if (item.type === 'role' && quantity > 1) {
            throw createError(
                'Invalid quantity',
                ErrorTypes.VALIDATION,
                '❌ You can only buy a role once.',
                { quantity }
            );
        }

        const totalCost = item.price * quantity;

        const userData = await getEconomyData(client, guildId, userId);

        // Balance check
        if (userData.wallet < totalCost) {
            throw createError(
                'Insufficient funds',
                ErrorTypes.VALIDATION,
                `❌ You need **$${totalCost.toLocaleString()}** but you only have **$${userData.wallet.toLocaleString()}**.`,
                { totalCost, wallet: userData.wallet }
            );
        }

        // Role ownership check
        if (item.type === 'role') {

            const role = interaction.guild.roles.cache.get(item.roleId);

            if (!role) {
                throw createError(
                    'Role not found',
                    ErrorTypes.CONFIGURATION,
                    '❌ This role does not exist anymore.',
                    { roleId: item.roleId }
                );
            }

            if (interaction.member.roles.cache.has(item.roleId)) {
                throw createError(
                    'Role already owned',
                    ErrorTypes.VALIDATION,
                    `❌ You already own the ${role.toString()} role.`,
                    { roleId: item.roleId }
                );
            }
        }

        // Deduct money
        userData.wallet -= totalCost;

        let successDescription =
            `✅ You purchased ${quantity}x **${item.name}** for **$${totalCost.toLocaleString()}**`;

        // ROLE PURCHASE
        if (item.type === 'role') {

            const member = interaction.member;

            const role = interaction.guild.roles.cache.get(item.roleId);

            if (!role) {

                // Refund
                userData.wallet += totalCost;
                await setEconomyData(client, guildId, userId, userData);

                throw createError(
                    'Role not found',
                    ErrorTypes.CONFIGURATION,
                    '❌ The role could not be found.',
                    { roleId: item.roleId }
                );
            }

            try {

                await member.roles.add(
                    role,
                    `Purchased role: ${item.name}`
                );

                successDescription += `\n\n👑 You received the role ${role.toString()}`;

            } catch (error) {

                // Refund money if failed
                userData.wallet += totalCost;

                await setEconomyData(client, guildId, userId, userData);

                throw createError(
                    'Role add failed',
                    ErrorTypes.DISCORD_API,
                    '❌ Failed to add the role. Your money has been refunded.',
                    {
                        roleId: item.roleId,
                        error: error.message
                    }
                );
            }

        }

        // UPGRADE PURCHASE
        else if (item.type === 'upgrade') {

            if (!userData.upgrades) {
                userData.upgrades = {};
            }

            userData.upgrades[itemId] = true;

            successDescription += '\n\n✨ Upgrade activated!';
        }

        // CONSUMABLE PURCHASE
        else if (item.type === 'consumable') {

            if (!userData.inventory) {
                userData.inventory = {};
            }

            userData.inventory[itemId] =
                (userData.inventory[itemId] || 0) + quantity;
        }

        // Save data
        await setEconomyData(client, guildId, userId, userData);

        // Success embed
        const embed = successEmbed(
            '🛒 Purchase Successful',
            successDescription
        ).addFields({
            name: '💵 Remaining Balance',
            value: `$${userData.wallet.toLocaleString()}`,
            inline: true
        });

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed],
            flags: [MessageFlags.Ephemeral]
        });

    }, { command: 'buy' })
};
