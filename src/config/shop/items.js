// shopItems.js

export const shopItems = [

    // =========================
    // RICH ROLE
    // =========================

    {
        id: 'rich',
        name: '💎 Rich',
        price: 30000,
        description: 'buy a rich role.',
        type: 'role',

        // Replace with your Rich Role ID
        roleId: '1355617103230537817',

        effect: {
            type: 'discord_role'
        }
    },

    // =========================
    // REDEEM ROLE
    // =========================

    {
        id: 'redeem',
        name: '🎟️ Redeem',
        price: 100000,
        description: 'Redeem for your service.',
        type: 'unlimited_role',

        // Replace with your Redeem Role ID
        roleId: '1507139496234324108',

        effect: {
            type: 'discord_role'
        }
    }
];

// =========================
// GET ITEM BY ID
// =========================

export function getItemById(itemId) {

    return shopItems.find(item => item.id === itemId);
}

// =========================
// GET ITEM PRICE
// =========================

export function getItemPrice(itemId) {

    const item = getItemById(itemId);

    return item ? item.price : 0;
}

// =========================
// VALIDATE PURCHASE
// =========================

export function validatePurchase(itemId, userData) {

    const item = getItemById(itemId);

    // Item not found
    if (!item) {

        return {
            valid: false,
            reason: 'Item not found.'
        };
    }

    // Create inventory if missing
    if (!userData.inventory) {
        userData.inventory = {};
    }

    // =========================
    // RICH ROLE CHECK
    // =========================

    // Rich role only once
    if (
        item.id === 'rich_role' &&
        userData.inventory.rich_role
    ) {

        return {
            valid: false,
            reason: 'You already own the Rich Role.'
        };
    }

    // =========================
    // REDEEM ROLE CHECK
    // =========================

    // Redeem role unlimited
    // No validation needed

    return {
        valid: true
    };
}
