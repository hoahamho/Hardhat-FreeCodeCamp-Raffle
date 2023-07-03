const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.parseEther("0.25") // 0.25 is the premium
const GAS_PRICE_LINK = 1e9 // calculated value based on the gas price of the chain

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    if (developmentChains.includes(network.name)) {
        log("Local network, deploying mocks...")
        // deploy a mock vrfCoordinator
        // await deployContract("VRFCoordinatorV2Mock", {
        //     from: deployer,
        //     log: true,
        //     arg: [BASE_FEE, GAS_PRICE_LINK],
        // })
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })
        log("VRF Mock deployed")
        log("--------------------------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]
