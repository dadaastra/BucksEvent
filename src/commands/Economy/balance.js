import { SlashCommandBuilder } from 'discord.js';
import { getEconomyData } from '../../utils/economy.js';
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

        // Defer reply safely
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        // Target user
        const targetUser =
            interaction.options.getUser('user') || interaction.user;

        const guildId = interaction.guildId;

        logger.debug(
            `[ECONOMY] Balance check for ${targetUser.id}`,
            {
                userId: targetUser.id,
                guildId
            }
        );

        // Prevent bots
        if (targetUser.bot) {

            throw createError(
                'Bot user queried for balance',
                ErrorTypes.VALIDATION,
                "Bots don't have an economy balance."
            );

        }

        // Get user economy data
        const userData = await getEconomyData(
            client,
            guildId,
            targetUser.id
        );

        // Database error
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

        // Safe wallet value
        const wallet =
            typeof userData.wallet === 'number'
                ? userData.wallet
                : 0;

        // Safe bank value
        const bank =
            typeof userData.bank === 'number'
                ? userData.bank
                : 0;

        // Total money
        const total = wallet + bank;

        // =========================
        // ECONOMY LEADERBOARD POSITION
        // =========================

        let leaderboardPosition = `userRank`;

        try {

            // SAME DATABASE AS ELEADERBOARD
            const allUsers =
                await client.db.get(`economy_${guildId}`) || {};

            // Convert object to leaderboard array
            const leaderboard = Object.entries(allUsers).map(
                ([userId, data]) => {

                    const userWallet =
                        typeof data.wallet === 'number'
                            ? data.wallet
                            : 0;

                    const userBank =
                        typeof data.bank === 'number'
                            ? data.bank
                            : 0;

                    return {
                        userId,
                        total: userWallet + userBank
                    };

                }
            );

            // Sort by highest money
            leaderboard.sort(
                (a, b) => b.total - a.total
            );

            // Find user rank
            const position = leaderboard.findIndex(
                user => user.userId === targetUser.id
            );

            // Set leaderboard position
            if (position !== -1) {

                leaderboardPosition = `#${position + 1}`;

            }

        } catch (err) {

            logger.error(
                '[ECONOMY] Failed to calculate leaderboard position',
                {
                    error: err.message
                }
            );

        }

        // =========================
        // RESPONSE MESSAGE
        // =========================

        let message;

        // Self balance
        if (targetUser.id === interaction.user.id) {

            message =
                `💵 Currently you have **$${total.toLocaleString()}** micebucks. $${userRank}`;

        }

        // Other user's balance
        else {

            message =
                `💰 ${targetUser.username} has **$${total.toLocaleString()}** micebucks.`;

        }

        logger.info(
            '[ECONOMY] Balance retrieved',
            {
                userId: targetUser.id,
                wallet,
                bank,
                total,
                leaderboardPosition
            }
        );

        // Send normal text reply
        await InteractionHelper.safeEditReply(
            interaction,
            {
                content: message
            }
        );

    }, { command: 'balance' })

};
