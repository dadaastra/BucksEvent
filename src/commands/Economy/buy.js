// buy.js

import {
    getItemById,
    validatePurchase
} from '../data/shopItems.js';

export async function buyItem(interaction, userData) {

    // =========================
    // GET ITEM
    // =========================

    const itemId = interaction.options.getString('item');

    const item = getItemById(itemId);

    // =========================
    // ITEM CHECK
    // =========================

    if (!item) {

        return interaction.reply({
            content: '❌ Item not found.',
            ephemeral: true
        });
    }

    // =========================
    // VALIDATE PURCHASE
    // =========================

    const validation = validatePurchase(itemId, userData);

    if (!validation.valid) {

        return interaction.reply({
            content: `❌ ${validation.reason}`,
            ephemeral: true
        });
    }

    // =========================
    // CHECK MONEY
    // =========================

    if (userData.wallet < item.price) {

        return interaction.reply({
            content:
                `❌ You need $${item.price.toLocaleString()} to buy this item.`,
            ephemeral: true
        });
    }

    // =========================
    // REMOVE MONEY
    // =========================

    userData.wallet -= item.price;

    // Create inventory
    if (!userData.inventory) {
        userData.inventory = {};
    }

    // =========================
    // NORMAL ROLE
    // =========================

    if (item.type === 'role') {

        // Get role
        const role =
            interaction.guild.roles.cache.get(item.roleId);

        if (!role) {

            return interaction.reply({
                content: '❌ Role not found.',
                ephemeral: true
            });
        }

        // Add role
        await interaction.member.roles.add(role);

        // Save ownership
        userData.inventory[item.id] = true;

        return interaction.reply({
            content:
                `✅ You bought **${item.name}** for **$${item.price.toLocaleString()}**`
        });
    }

    // =========================
    // UNLIMITED REDEEM ROLE
    // =========================

    if (item.type === 'unlimited_role') {

        // Get role
        const role =
            interaction.guild.roles.cache.get(item.roleId);

        if (!role) {

            return interaction.reply({
                content: '❌ Role not found.',
                ephemeral: true
            });
        }

        // Add role if user doesn't already have it
        if (!interaction.member.roles.cache.has(role.id)) {

            await interaction.member.roles.add(role);
        }

        // Track purchase count
        if (!userData.inventory.redeem_role_count) {
            userData.inventory.redeem_role_count = 0;
        }

        userData.inventory.redeem_role_count++;

        return interaction.reply({
            content:
                `✅ You bought **${item.name}** for **$${item.price.toLocaleString()}**\n🎟️ Total Redeem Purchases: ${userData.inventory.redeem_role_count}`
        });
    }

    // =========================
    // UNKNOWN ITEM
    // =========================

    return interaction.reply({
        content: '❌ Unknown item type.',
        ephemeral: true
    });
}
