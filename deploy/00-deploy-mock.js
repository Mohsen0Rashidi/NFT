const { deployments, getNamedAccounts, network, ethers } = require("hardhat")
const { developmentCahins } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25")
const GAS_PRICE_LINK = 1e9
module.exports = async ({ deployments, getNamedAccounts }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    if (developmentCahins.includes(network.name)) {
        log("Local network detcted!")
        const vrfCoordinatorV2Mock = await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            args: [BASE_FEE, GAS_PRICE_LINK],
            log: true,
        })
    }
    log("---------------------------------")
}

module.exports.tags = ["all", "mocks", "main"]
