const { network, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const FUND_AMOUNT = ethers.parseEther("30")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        vrfCoordinatorV2Address = await vrfCoordinatorV2Mock.getAddress()

        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)

        // subscriptionId = transactionReceipt.events[0].args.subId
        subscriptionId = transactionReceipt.logs[0].args.subId
        // subscriptionId = transactionReceipt.logs[0].args.owner
        log(typeof subscriptionId)
        // Fund the subscription
        // Usually, you'd need the Link token on a real network

        // I have to comment out this, because i havent known how to fix.
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]

    const args = [
        vrfCoordinatorV2Address,
        subscriptionId,
        gasLane,
        interval,
        entranceFee,
        callbackGasLimit,
    ]
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    // const abc = await ethers.getContract("Raffle")
    // const bbb = await abc.getInterval()
    // log(bbb)
    // const ccc = await abc.getEntranceFee()
    // log(ccc)

    /*  In latest version of Chainlink/contracts 0.6.1 or after 0.4.1, 
        we need to add consumer explicitly after deployment of contract
        refer: https://github.com/smartcontractkit/full-blockchain-solidity-course-js/discussions/1565
    */
    if (developmentChains.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
        log("Consumer is added")
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(raffle.address, args)
    }
    log("-------------------------------------------")
}

module.exports.tags = ["all", "raffle"]
