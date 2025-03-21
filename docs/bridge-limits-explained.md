# Set Limits Documentation

## How It Works

### Owner Restriction

The function is marked as `onlyOwner` so that only the owner may call it.

### Calls Internal Functions

It calls two internal functions:

```solidity
_changeMinterLimit(_bridge, _mintingLimit);
_changeBurnerLimit(_bridge, _burningLimit);
```

Each of these functions:

- Retrieves the old maximum limit.
- Obtains the current limit via a helper (e.g., `mintingCurrentLimitOf`), which accounts for any replenishment over time.
- Updates the maximum limit to the new value.
- Recalculates the current limit by calling `_calculateNewCurrentLimit`:
  - If the new limit is higher, the current limit increases by the difference.
  - If the new limit is lower, the current limit decreases by the difference (but not below zero).
- Sets a new rate per second using:
  ```solidity
  ratePerSecond = newLimit / 1 day;
  ```
- Updates the timestamp to the current block time so that future calculations are based on the new update time.

### Emits an Event

After both updates are applied, the function emits the `BridgeLimitsSet` event with the new minting and burning limits and the bridge address.

## Current Limit Behavior

### Replenishment Over Time

Each bridge has a max limit (set through the owner) and a current limit that increases over time according to a fixed rate (calculated as `maxLimit / duration`, where duration is defined as `1 day`).

The function `_getCurrentLimit` shows that if enough time passes (i.e., at least one day), the current limit is fully replenished (i.e., equals the max limit). For smaller time intervals, the current limit is incremented based on the time passed multiplied by the rate per second.

### Usage of the Limit

When tokens are minted or burned by a bridge (except when the caller is the lockbox), the current limit is decreased by the used amount. This is done by functions like `_useMinterLimits` and `_useBurnerLimits`, which update both the timestamp and the current limit.

### Modifying the Limits via `setLimits`

When the owner calls `setLimits`, the contract calls `_changeMinterLimit` and `_changeBurnerLimit`, which do the following:

1. Capture the old max limit.
2. Calculate the current limit using the previous state and the elapsed time.
3. Update the max limit to the new value.
4. Adjust the current limit using `_calculateNewCurrentLimit`:
   - If the new max limit is higher: The available quota increases by the difference.
   - If the new max limit is lower: The available quota decreases by the difference (but it cannot go below zero).
5. Ensures that any usage before the change is taken into account smoothly.

## Examples

### New Limit > Current Limit

Below is an example sequence of updates where the new max limit is always greater than the current limit.

| #   | Operation | Old Max Limit | New Max Limit | Difference | Previous Current Limit | New Current Limit | Used Quota | Updated Rate (txs/sec) |
| --- | --------- | ------------- | ------------- | ---------- | ---------------------- | ----------------- | ---------- | ---------------------- |
| 1   | Increase  | 1,000         | 1,200         | +200       | 600                    | 800               | 400        | 0.01389                |
| 2   | Decrease  | 1,200         | 1,100         | -100       | 800                    | 700               | 400        | 0.01273                |
| 3   | Increase  | 1,100         | 1,300         | +200       | 700                    | 900               | 400        | 0.01505                |
| 4   | Decrease  | 1,300         | 1,250         | -50        | 900                    | 850               | 400        | 0.01446                |
| 5   | Increase  | 1,250         | 1,400         | +150       | 850                    | 1,000             | 400        | 0.01620                |
| 6   | Decrease  | 1,400         | 1,350         | -50        | 1,000                  | 950               | 400        | 0.01562                |

### New Limit < Current Limit

Below is an example sequence of six updates where the current limit starts closer to zero.

| #   | Operation | Old Max Limit | New Max Limit | Difference | Previous Current Limit | New Current Limit | Used Quota | Updated Rate (txs/sec) |
| --- | --------- | ------------- | ------------- | ---------- | ---------------------- | ----------------- | ---------- | ---------------------- |
| 1   | Increase  | 1,000         | 1,200         | +200       | 100                    | 300               | 900        | 0.01389                |
| 2   | Decrease  | 1,200         | 1,100         | -100       | 300                    | 200               | 900        | 0.01273                |
| 3   | Decrease  | 1,100         | 800           | -300       | 200                    | 0                 | 800        | 0.00926                |
| 4   | Increase  | 800           | 1,000         | +200       | 0                      | 200               | 800        | 0.01157                |
| 5   | Decrease  | 1,000         | 900           | -100       | 200                    | 100               | 800        | 0.01042                |
| 6   | Decrease  | 900           | 700           | -200       | 100                    | 0                 | 700        | 0.00810                |

## Observations

1. If the new `CurrentLimit` goes to 0, the used quota becomes the new max limit (all transactions have been used). Therefore, no transactions are available at the current time, and more will be freed with the new update rate calculated.
2. Each update only adjusts the current limit by the difference in max limits, ensuring proportional usage is preserved regardless of how many times or how quickly the limits are changed.

---

This document explains the workings of `setLimits` in detail, covering owner permissions, internal function calls, event emissions, replenishment mechanics, and multiple examples of how limits change dynamically over time.
