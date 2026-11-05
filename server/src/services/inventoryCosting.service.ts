export class InventoryCostingService {
  calculateWeightedAverageCost(
    currentQuantity: number,
    currentAverageCost: number,
    incomingQuantity: number,
    incomingUnitCost: number
  ): { averageCost: number; totalValue: number } {
    const totalCurrentValue = Math.max(0, currentQuantity * currentAverageCost);
    const incomingValue = Math.max(0, incomingQuantity * incomingUnitCost);
    const finalQuantity = currentQuantity + incomingQuantity;

    if (finalQuantity <= 0) {
      return {
        averageCost: incomingUnitCost > 0 ? incomingUnitCost : currentAverageCost,
        totalValue: 0,
      };
    }

    const totalValue = totalCurrentValue + incomingValue;
    const averageCost = Math.round((totalValue / finalQuantity) * 10000) / 10000; // 4 decimal places

    return {
      averageCost,
      totalValue: Math.round(totalValue * 100) / 100, // 2 decimal places
    };
  }
}

export const inventoryCostingService = new InventoryCostingService();
