const ethers = require('ethers')
const { JSON_RPC_URL } = require('../constants')

const provider = new ethers.providers.JsonRpcProvider(JSON_RPC_URL)

const blocks = {}

// binary search function for finding the closest block to a timestamp
async function lookupBlockByTimestamp(timestamp, blockNumber) {
  let block
  if (!blockNumber) {
    const firstBlock = blocks[1] || (await provider.getBlock(1))
    blocks[1] = firstBlock
    const lastBlock = await provider.getBlock()
    blocks[lastBlock.number] = lastBlock
    if (timestamp < firstBlock.timestamp) {
      throw new Error(`timestamp preceeds ethereum blockchain, block 1 at ${firstBlock.timestamp}`)
    } else if (timestamp > lastBlock.timestamp) {
      return lastBlock.number
    }
    block = await provider.getBlock()
  } else {
    block = blocks[blockNumber] || (await provider.getBlock(blockNumber))
  }
  blocks[block.number] = block
  const differenceInSeconds = timestamp - block.timestamp
  const averageBlockSeconds = 15
  const blockNumberDifferenceEstimate = Math.floor(differenceInSeconds / averageBlockSeconds)
  const newComparisonBlockNumber = Math.abs(block.number + blockNumberDifferenceEstimate)
  const newComparisonBlock = blocks[newComparisonBlockNumber] || (await provider.getBlock(newComparisonBlockNumber))
  blocks[newComparisonBlock.number] = newComparisonBlock
  const timedifference = timestamp - newComparisonBlock.timestamp
  if (Math.abs(timedifference) < averageBlockSeconds) {
    return newComparisonBlockNumber
  }
  return lookupBlockByTimestamp(timestamp, newComparisonBlockNumber)
}

module.exports = { lookupBlockByTimestamp }
