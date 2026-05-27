import { SlashCommandBuilder } from 'discord.js';
import { getEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Check your or someone else's balance")
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to check balance for')
                .setRequired(false)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {

        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guildId;

        logger.debug(`[ECONOMY] Balance check for ${targetUser.id}`, {
            userId: targetUser.id,
            guildId
        });

        // Bots can't use economy
        if (targetUser.bot) {
            throw createError(
                'Bot user queried for balance',
                ErrorTypes.VALIDATION,
                "Bots don't have an economy balance."
            );
        }

        // Get user economy data
        const userData = await getEconomyData(client, guildId, targetUser.id);

        if (!userData) {
            throw createError(
                'Failed to load economy data',
                ErrorTypes.DATABASE,
                'Failed to load economy data. Please try again later.',
                {
                    userId: targetUser.id,
                    guildId
                }
            );
        }

        // Safe values
        const wallet = typeof userData.wallet === 'number'
            ? userData.wallet
            : 0;

        const bank = typeof userData.bank === 'number'
            ? userData.bank
            : 0;

        const total = wallet + bank;

        // =========================
        // LEADERBOARD POSITION SYSTEM
        // =========================

        let leaderboardPosition = 'Unknown';

        try {

            // Get all users from guild economy
            const allUsers = await client.db.get(
                `economy_${guildId}`
            ) || {};

            // Convert users to array
            const leaderboard = Object.entries(allUsers).map(([userId, data]) => {

                const userWallet = typeof data.wallet === 'number'
                    ? data.wallet
                    : 0;

                const userBank = typeof data.bank === 'number'
                    ? data.bank
                    : 0;

                return {
                    userId,
                    total: userWallet + userBank
                };

            });

            // Sort highest to lowest
            leaderboard.sort((a, b) => b.total - a.total);

            // Find user position
            const position = leaderboard.findIndex(
                user => user.userId === targetUser.id
            );

            leaderboardPosition = position !== -1
                ? `#${position + 1}`
                : 'Unranked';

        } catch (err) {

            logger.error('[ECONOMY] Failed to calculate leaderboard position', {
                error: err.message
            });

        }

        // =========================
        // TEXT RESPONSE
        // =========================

        let message;

        if (targetUser.id === interaction.user.id) {

            message =
                `💰 You have **$${total.toLocaleString()}** bucks and you are **${leaderboardPosition}** on the leaderboard.`;

        } else {

            message =
                `💰 ${targetUser.username} has **$${total.toLocaleString()}** bucks and is **${leaderboardPosition}** on the leaderboard.`;

        }

        logger.info('[ECONOMY] Balance retrieved', {
            userId: targetUser.id,
            wallet,
            bank,
            total,
            leaderboardPosition
        });

        // Send text reply
        await InteractionHelper.safeEditReply(interaction, {
            content: message
        });

    }, { command: 'balance' })
};
