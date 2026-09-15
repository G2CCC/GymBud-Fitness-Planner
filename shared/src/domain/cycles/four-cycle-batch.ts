export type CycleBatchRange = {
  startCycleNumber: number;
  endCycleNumber: number;
};

export function getCycleBatchRange(cycleNumber: number): CycleBatchRange {
  assertCycleNumber(cycleNumber);
  const startCycleNumber = Math.floor((cycleNumber - 1) / 4) * 4 + 1;

  return {
    startCycleNumber,
    endCycleNumber: startCycleNumber + 3,
  };
}

export function isCycleBatchBoundary(cycleNumber: number): boolean {
  assertCycleNumber(cycleNumber);
  return cycleNumber % 4 === 0;
}

function assertCycleNumber(cycleNumber: number): void {
  if (!Number.isInteger(cycleNumber) || cycleNumber < 1) {
    throw new RangeError("cycleNumber must be a positive integer");
  }
}

