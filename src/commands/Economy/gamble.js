import { SlashCommandBuilder } from 'discord.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';

const BASE_WIN_CHANCE = 0.4;
const CLOVER_WIN_BONUS = 0.1;
const CHARM_WIN_BONUS = 0.08;
const PAYOUT_MULTIPLIER = 2.0;
const GAMBLE_COOLDOWN = 10 * 1000; // 10 seconds cooldown

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
                const seconds = Math.ceil(remaining / 1000);
                
                const cooldownMessage = `⏰ **Cooldown Active!** Please wait **${seconds} seconds** before gambling again.`;
                
                if (deferred) {
                    await interaction.editReply({ content: cooldownMessage });
                } else {
                    await interaction.reply({ content: cooldownMessage });
                }
                return;
            }

            // Check if user has enough money
            if (userData.wallet < betAmount) {
                const insufficientMessage = `💰 **Insufficient Funds!** You only have **$${userData.wallet.toLocaleString()}** cash, but you're trying to bet **$${betAmount.toLocaleString()}**.`;
                
                if (deferred) {
                    await interaction.editReply({ content: insufficientMessage });
                } else {
                    await interaction.reply({ content: insufficientMessage });
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
                itemMessage = ` 🍀 (Lucky Clover used - Win chance: ${Math.round(winChance * 100)}%)`;
                usedClover = true;
            } else if (charmCount > 0) {
                winChance += CHARM_WIN_BONUS;
                userData.inventory.lucky_charm -= 1;
                const remainingCharms = userData.inventory.lucky_charm;
                itemMessage = ` ✨ (Lucky Charm used - Win chance: ${Math.round(winChance * 100)}% - ${remainingCharms} uses left)`;
                usedCharm = true;
            }

            // Determine win/loss
            const win = Math.random() < winChance;
            let cashChange = 0;
            let resultMessage = "";

            if (win) {
                const amountWon = Math.floor(betAmount * PAYOUT_MULTIPLIER);
                cashChange = amountWon;
                resultMessage = `🎉 **Congratulations!** 🎉\nYou won **$${amountWon.toLocaleString()}** from your $${betAmount.toLocaleString()} bet!${itemMessage}`;
            } else {
                cashChange = -betAmount;
                resultMessage = `💔 **Alas!** 💔\nYou lost the gamble. Better luck next time! You lost **$${betAmount.toLocaleString()}**.${itemMessage}`;
            }

            // Update user data
            userData.wallet = (userData.wallet || 0) + cashChange;
            userData.lastGamble = now;

            await setEconomyData(client, guildId, userId, userData);

            // Add balance info to message
            resultMessage += `\n\n💰 **New Balance:** $${userData.wallet.toLocaleString()}`;
            
            // Add item info to message
            if (usedClover) {
                const remainingClovers = userData.inventory.lucky_clover || 0;
                resultMessage += `\n🍀 **Remaining Lucky Clovers:** ${remainingClovers}`;
            } else if (usedCharm) {
                const remainingCharms = userData.inventory.lucky_charm || 0;
                resultMessage += `\n✨ **Remaining Lucky Charm uses:** ${remainingCharms}`;
            }
            
            // Add cooldown info
            resultMessage += `\n⏰ **Next gamble available in 10 seconds**`;

            // Send the reply
            if (deferred) {
                await interaction.editReply({ content: resultMessage });
            } else {
                await interaction.reply({ content: resultMessage });
            }

        } catch (error) {
            console.error('Error in gamble command:', error);
            
            const errorMessage = "❌ **Error!** An error occurred while processing your gamble. Please try again later.";
            
            if (deferred) {
                await interaction.editReply({ content: errorMessage }).catch(console.error);
            } else {
                await interaction.reply({ content: errorMessage }).catch(console.error);
            }
        }
    })
};
