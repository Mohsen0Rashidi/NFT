const { deployments, getNamedAccounts, network, ethers } = require("hardhat")
const { developmentCahins, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const {
    storeImages,
    storeTokenUriMetadata,
} = require("../utils/uploadToPinata")

const FUND_AMOUNT = ethers.utils.parseEther("10")
const imageLocation = "./images/randomNft"
let tokenUris = [
    "ipfs://QmaVkBn2tKmjbhphU7eyztbvSQU5EXDdqRyXZtRhSGgJGo",
    "ipfs://QmYQC5aGZu2PTH8XzbJrbDnvhj3gVs7ya33H9mqUNvST3d",
    "ipfs://QmZYmH5iDbD6v3U2ixoVAjioSzvWJszDzYdbeCLquGSpVm",
]

const metadataTemplate = {
    name: "",
    description: "",
    image: "",
    attributes: [
        {
            trait_type: "Cuteness",
            value: 100,
        },
    ],
}

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    if (process.env.UPLOAD_TO_PINATA == "true") {
        tokenUris = await handleTokenUris()
    }

    let vrfCoordinatorV2Mock, vrfCoordinatorV2Address, subscriptionId

    if (developmentCahins.includes(network.name)) {
        // create VRFV2 Subscription
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const transactionResponse =
            await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = await transactionReceipt.events[0].args.subId
        // Fund the subscription
        // Our mock makes it so we don't actually have to worry about sending fund
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
        subscriptionId = networkConfig[chainId].subscriptionId
    }

    const arguments = [
        vrfCoordinatorV2Address,
        subscriptionId,
        networkConfig[chainId].gasLane,
        networkConfig[chainId].callbackGasLimit,
        networkConfig[chainId].mintFee,
        tokenUris,
    ]

    const randomNft = await deploy("RandomNft", {
        from: deployer,
        args: arguments,
        log: true,
        waitConfirmatins: network.config.blockConfirmations || 1,
    })
    log("-----------------------------------")

    if (developmentCahins.includes(network.name)) {
        vrfCoordinatorV2Mock.addConsumer(subscriptionId, randomNft.address)
    }

    // Verify the deployment

    if (
        !developmentCahins.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        console.log("Verifying...")
        await verify(randomNft.address, arguments)
    }
}

async function handleTokenUris() {
    tokenUris = []

    const { responses: imageUploadResponses, files } = await storeImages(
        imageLocation
    )
    for (imageUploadResponsesIndex in imageUploadResponses) {
        let tokenUrisMetadata = { ...metadataTemplate }
        tokenUrisMetadata.name = files[imageUploadResponsesIndex].replace(
            ".png",
            ""
        )
        tokenUrisMetadata.description = `An adorable ${tokenUrisMetadata.name} pup!`

        tokenUrisMetadata.image = `ipfs://${imageUploadResponses[imageUploadResponsesIndex].IpfsHash}`
        console.log(`Uploading ${tokenUrisMetadata.name}...`)

        const metadataUploadResponse = await storeTokenUriMetadata(
            tokenUrisMetadata
        )
        tokenUris.push(`ipfs://${metadataUploadResponse.IpfsHash}`)
    }

    console.log("Token URIs uploaded.They are...")
    console.log(tokenUris)

    return tokenUris
}

module.exports.tags = ["all", "randomnft", "main"]
