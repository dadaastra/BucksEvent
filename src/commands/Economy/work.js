import { SlashCommandBuilder } from 'discord.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const WORK_COOLDOWN = 5 * 60 * 1000;
const MIN_WORK_AMOUNT = 10;
const MAX_WORK_AMOUNT = 100;
const LAPTOP_MULTIPLIER = 1.5;

const WORK_JOBS = [
    "Software Developer",
    "Barista",
    "Janitor",
    "YouTuber",
    "Discord Bot Developer",
    "Cashier",
    "Pizza Delivery Driver",
    "Librarian",
    "Gardener",
    "Data Analyst",
];

export default {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn some money'),

    execute: withErrorHandling(async (interaction, config, client) => {

        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const now = Date.now();

        const userData = await getEconomyData(client, guildId, userId);

        if (!userData) {
            await InteractionHelper.safeEditReply(interaction, {
                content: `❌ Failed to load your economy data. Please try again later.`
            });
            return;
        }

        logger.debug(`[ECONOMY] Work command started for ${userId}`, {
            userId,
            guildId
        });

        const lastWork = userData.lastWork || 0;

        const inventory = userData.inventory || {};

        const extraWorkShifts = inventory["extra_work"] || 0;
        const hasLaptop = inventory["laptop"] || 0;

        let cooldownActive = now < lastWork + WORK_COOLDOWN;

        let usedConsumable = false;

        if (cooldownActive) {

            if (extraWorkShifts > 0) {

                inventory["extra_work"] =
                    (inventory["extra_work"] || 0) - 1;

                usedConsumable = true;

            } else {

                const remaining =
                    (lastWork + WORK_COOLDOWN) - now;

                const hours =
                    Math.floor(remaining / 3600000);

                const minutes =
                    Math.floor((remaining % 3600000) / 60000);

                const seconds =
                    Math.floor((remaining % 60000) / 1000);

                await InteractionHelper.safeEditReply(interaction, {
                    content:
                        `Be ready for work, time will be end in **${hours}h ${minutes}m ${seconds}s** later.`
                });

                return;
            }
        }

        let earned =
            Math.floor(
                Math.random() *
                (MAX_WORK_AMOUNT - MIN_WORK_AMOUNT + 1)
            ) + MIN_WORK_AMOUNT;

        const job =
            WORK_JOBS[
                Math.floor(Math.random() * WORK_JOBS.length)
            ];

        if (hasLaptop > 0) {
            earned = Math.floor(earned * LAPTOP_MULTIPLIER);
        }

        userData.wallet =
            (userData.wallet || 0) + earned;

        userData.lastWork = now;

        await setEconomyData(
            client,
            guildId,
            userId,
            userData
        );

        logger.info(`[ECONOMY_TRANSACTION] Work completed`, {
            userId,
            guildId,
            amount: earned,
            job,
            usedConsumable,
            hasLaptop: hasLaptop > 0,
            newWallet: userData.wallet,
            timestamp: new Date().toISOString()
        });

        await InteractionHelper.safeEditReply(interaction, {
            content:
                `You finished work and earned **<:1780553643790:1512073620229460040>${earned.toLocaleString()}** anastar in wallet!!`
        });

        return;

    }, { command: 'work' })
};
