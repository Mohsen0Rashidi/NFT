const { assert, expect } = require("chai")
const { network, ethers, deployments } = require("hardhat")
const { developmentCahins } = require("../../helper-hardhat-config")

!developmentCahins.includes(network.name)
    ? describe.skip
    : describe("Random NFT unit test", function () {
          let randomNft, vrfCoordinatorV2Mock, deployer, accounts

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]

              await deployments.fixture(["mocks", "randomnft"])
              randomNft = await ethers.getContract("RandomNft")
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock"
              )
          })
          describe("constructor", () => {
              it("Initialized token URIs correctly", async () => {
                  const dogTokenUriZero = await randomNft.getDogTokenUris(0)
                  assert(dogTokenUriZero.includes("ipfs://"))
              })
              it("Initialized correctly", async () => {
                  const isInitialized = await randomNft.getInitialized()
                  assert.equal(isInitialized, true)
              })
          })
          describe("Request NFT", () => {
              it("fails if payment isn't sent with the request", async () => {
                  await expect(
                      randomNft.requestNft()
                  ).to.be.revertedWithCustomError(
                      randomNft,
                      "RandomNft__NeedMoreETHToSent"
                  )
              })
              it("reverts if payment amount is less than the mint fee", async () => {
                  const fee = await randomNft.getMintFee()
                  await expect(
                      randomNft.requestNft({
                          value: fee.sub(ethers.utils.parseEther("0.0001")),
                      })
                  ).to.be.revertedWithCustomError(
                      randomNft,
                      "RandomNft__NeedMoreETHToSent"
                  )
              })
              it("emits an event and kicks off a random word request", async () => {
                  const fee = await randomNft.getMintFee()
                  await expect(randomNft.requestNft({ value: fee })).to.emit(
                      randomNft,
                      "NftRequested"
                  )
              })
          })
          describe("fulfillRandomWords", () => {
              it("mints NFT after random number is returned", async () => {
                  await new Promise(async (resolve, reject) => {
                      randomNft.once("NftMinted", async () => {
                          try {
                              const tokenUri = await randomNft.getDogTokenUris(
                                  "0"
                              )
                              const tokenCounter =
                                  await randomNft.getTokenCounter()

                              assert.equal(
                                  tokenUri.toString().includes("ipfs://"),
                                  true
                              )
                              assert.equal(tokenCounter.toString(), "1")
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(error)
                          }
                      })
                      try {
                          const fee = await randomNft.getMintFee()
                          const requestNftResponse = await randomNft.requestNft(
                              { value: fee.toString() }
                          )
                          const requestNftReceipt =
                              await requestNftResponse.wait(1)
                          await vrfCoordinatorV2Mock.fulfillRandomWords(
                              requestNftReceipt.events[1].args.requestId,
                              randomNft.address
                          )
                      } catch (error) {
                          console.log(error)
                      }
                  })
              })
          })
          describe("getBreedFromModdedRbg", () => {
              it("should return pug if moddedRng < 10", async () => {
                  const expectedValue =
                      await randomNft.getDogBreedFromModdedRng(7)
                  assert.equal(0, expectedValue)
              })
              it("should return shiba-inu if moddedRng is between 10-39", async () => {
                  const expectedValue =
                      await randomNft.getDogBreedFromModdedRng(22)
                  assert.equal(1, expectedValue)
              })
              it("should return st-bernard if moddedRng between 40-99", async () => {
                  const expectedValue =
                      await randomNft.getDogBreedFromModdedRng(88)
                  assert.equal(2, expectedValue)
              })
              it("should reverts if moddedRng > 99", async () => {
                  await expect(
                      randomNft.getDogBreedFromModdedRng(100)
                  ).to.be.revertedWithCustomError(
                      randomNft,
                      "RandomNft__RangeOutOfBounds"
                  )
              })
          })
          describe("withdraw", () => {
              it("withdraw mint fee ", async () => {
                  const fee = await randomNft.getMintFee()
                  await randomNft.requestNft({ value: fee.toString() })

                  const startingRandomNftBalance =
                      await randomNft.provider.getBalance(randomNft.address)
                  const startingOwnerBalance =
                      await randomNft.provider.getBalance(deployer.address)

                  const transactionResponse = await randomNft.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)

                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  const endingRandomNftBalance =
                      await randomNft.provider.getBalance(randomNft.address)
                  const endingOwnerBalance =
                      await randomNft.provider.getBalance(deployer.address)

                  assert.equal(endingRandomNftBalance.toString(), "0")
                  assert.equal(
                      startingRandomNftBalance
                          .add(startingOwnerBalance)
                          .toString(),
                      endingOwnerBalance.add(gasCost).toString()
                  )
              })
              it("Only allows the owner to withdraw", async () => {
                  const fakeOwner = accounts[1]
                  const fee = await randomNft.getMintFee()
                  const contractConnectedToFakeOwner = await randomNft.connect(
                      fakeOwner
                  )
                  await contractConnectedToFakeOwner.requestNft({
                      value: fee.toString(),
                  })
                  await expect(
                      contractConnectedToFakeOwner.withdraw()
                  ).to.be.revertedWith("Ownable: caller is not the owner")
              })
          })
      })
