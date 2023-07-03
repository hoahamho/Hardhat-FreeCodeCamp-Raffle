# Lottery Hardhat Project

This project allow people enter raffle. Using Chainlink VRF to get provably random number and Chainlink Keeper to autmate trigger send money to the winner.

1. Hardhat update and some plugin update so many code change.

Example:
Old code:

```shell
vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
subscriptionId = transactionReceipt.events[0].args.subId
```

New code:

```shell
vrfCoordinatorV2Address = await vrfCoordinatorV2Mock.getAddress()
subscriptionId = transactionReceipt.logs[0].args.subId
```

And delete this code

```shell
await vrfCoordinatorV2Mock.fundSubcription(subscriptionId, VRF_SUB_FUND_AMOUNT)
```

2. Deathly error #1: past the arguments to constructor of Smart Contract but not in order

3. In latest version of Chainlink/contracts 0.6.1 or after 0.4.1,
   we need to add consumer explicitly after deployment of contract
   refer: https://github.com/smartcontractkit/full-blockchain-solidity-course-js/discussions/1565

```shell
    if (developmentChains.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
        log("Consumer is added")
    }
```

4. Convert number to bytes in ethersjs
   ethers also has a padding function where it will add the zeros to make it the correct length. It looks like this

```shell
    const oracleResponse = ethers.utils.hexZeroPad(ethers.utils.hexlify(1), 32)
```

    This will pad your result to be length 32, and allow it to be accepted by your function.

5. "callStatic" became "staticCall"
   ethers v5:

```shell
    const { upkeepNeeded } = await raffle.callstatic.checkUpkeep([])
```

    ethers v6:

```shell
    const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
```

6. Listener didnt work although the code work perfectly (i've already check on blockscan, Chainlink VRF and Chainlink Keeper pages). Maybe ethers v6 is the reason.
