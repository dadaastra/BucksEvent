import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const BASE_WIN_CHANCE = 0.4;
const CLOVER_WIN_BONUS = 0.1;
const CHARM_WIN_BONUS = 0.08;
const PAYOUT_MULTIPLIER = 2.0;
const GAMBLE_COOLDOWN = 5 * 60 * 1000;

export default {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Gamble your money for a chance to win more')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of cash to gamble')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        // Properly handle the interaction deferral
        let deferred = false;
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
                deferred = true;
            }
        } catch (error) {
            console.error('Failed to defer reply:', error);
        }

        try {
            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const betAmount = interaction.options.getInteger("amount");
            const now = Date.now();

            // Get user data
            const userData = await getEconomyData(client, guildId, userId);
            const lastGamble = userData.lastGamble || 0;
            let cloverCount = userData.inventory?.lucky_clover || 0;
            let charmCount = userData.inventory?.lucky_charm || 0;

            // Check cooldown
            if (now < lastGamble + GAMBLE_COOLDOWN) {
                const remaining = lastGamble + GAMBLE_COOLDOWN - now;
                const minutes = Math.floor(remaining / (1000 * 60));
                const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

                const cooldownEmbed = errorEmbed(
                    "⏰ Cooldown Active",
                    `You need to cool down before gambling again. Wait **${minutes}m ${seconds}s**.`
                );
                
                if (deferred) {
                    await interaction.editReply({ embeds: [cooldownEmbed] });
                } else {
                    await interaction.reply({ embeds: [cooldownEmbed] });
                }
                return;
            }

            // Check if user has enough money
            if (userData.wallet < betAmount) {
                const insufficientEmbed = errorEmbed(
                    "💰 Insufficient Funds",
                    `You only have **$${userData.wallet.toLocaleString()}** cash, but you are trying to bet **$${betAmount.toLocaleString()}**.`
                );
                
                if (deferred) {
                    await interaction.editReply({ embeds: [insufficientEmbed] });
                } else {
                    await interaction.reply({ embeds: [insufficientEmbed] });
                }
                return;
            }

            // Calculate win chance with items
            let winChance = BASE_WIN_CHANCE;
            let itemMessage = "";
            let usedClover = false;
            let usedCharm = false;
            
            if (cloverCount > 0) {
                winChance += CLOVER_WIN_BONUS;
                userData.inventory.lucky_clover -= 1;
                itemMessage = `\n🍀 **Lucky Clover Consumed:** Your win chance was boosted to ${Math.round(winChance * 100)}%!`;
                usedClover = true;
            } else if (charmCount > 0) {
                winChance += CHARM_WIN_BONUS;
                userData.inventory.lucky_charm -= 1;
                const remainingCharms = userData.inventory.lucky_charm;
                itemMessage = `\n✨ **Lucky Charm Used:** Your win chance was boosted to ${Math.round(winChance * 100)}%! (${remainingCharms} uses remaining)`;
                usedCharm = true;
            }

            // Determine win/loss
            const win = Math.random() < winChance;
            let cashChange = 0;
            let resultEmbed;

            if (win) {
                const amountWon = Math.floor(betAmount * PAYOUT_MULTIPLIER);
                cashChange = amountWon;

                resultEmbed = successEmbed(
                    "🎉 You Won! 🎉",
                    `You gambled **$${betAmount.toLocaleString()}** and won **$${amountWon.toLocaleString()}**!${itemMessage}`
                );
            } else {
                cashChange = -betAmount;

                resultEmbed = errorEmbed(
                    "💔 You Lost... 💔",
                    `You gambled **$${betAmount.toLocaleString()}** and lost it all. Better luck next time!${itemMessage}`
                );
            }

            // Update user data
            userData.wallet = (userData.wallet || 0) + cashChange;
            userData.lastGamble = now;

            await setEconomyData(client, guildId, userId, userData);

            // Add balance field to embed
            resultEmbed.addFields({
                name: "💰 New Balance",
                value: `$${userData.wallet.toLocaleString()}`,
                inline: true
            });

            // Add win chance to embed
            resultEmbed.addFields({
                name: "🎲 Win Chance",
                value: `${Math.round(winChance * 100)}%`,
                inline: true
            });

            // Set footer with additional info
            if (usedClover) {
                const remainingClovers = userData.inventory.lucky_clover || 0;
                resultEmbed.setFooter({ 
                    text: `🍀 ${remainingClovers} Lucky Clovers remaining | Cooldown: 5 minutes` 
                });
            } else if (usedCharm) {
                const remainingCharms = userData.inventory.lucky_charm || 0;
                resultEmbed.setFooter({ 
                    text: `✨ ${remainingCharms} Lucky Charm uses remaining | Cooldown: 5 minutes` 
                });
            } else {
                resultEmbed.setFooter({ 
                    text: `Base win chance: ${Math.round(BASE_WIN_CHANCE * 100)}% | Cooldown: 5 minutes` 
                });
            }

            // Set timestamp
            resultEmbed.setTimestamp();

            // Send the reply
            if (deferred) {
                await interaction.editReply({ embeds: [resultEmbed] });
            } else {
                await interaction.reply({ embeds: [resultEmbed] });
            }

        } catch (error) {
            console.error('Error in gamble command:', error);
            
            const errorMessage = errorEmbed(
                "❌ Error",
                "An error occurred while processing your gamble. Please try again later."
            );
            
            if (deferred) {
                await interaction.editReply({ embeds: [errorMessage] }).catch(console.error);
            } else {
                await interaction.reply({ embeds: [errorMessage] }).catch(console.error);
            }
        }
    })
};
