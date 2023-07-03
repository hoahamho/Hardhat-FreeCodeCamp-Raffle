const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle unit tests", function () {
          let deployer, raffleContract, raffle, raffleEntranceFee
          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              raffleContract = await ethers.getContract("Raffle")
              raffle = raffleContract.connect(deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
          })

          describe("fulfillRandomWords", () => {
              it("works with Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
                  console.log("seting up test...")
                  const startingTimeStamp = await raffle.getLastTimeStamp()
                  console.log("Setting up listener...")
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance = await ethers.provider.getBalance(
                                  accounts[0]
                              )
                              const endingTimeStamp = await raffle.getLastTimeStamp()
                              await expect(raffle.getPlayer(0)).to.be.reverted
                              assert.equal(
                                  recentWinner.toString(),
                                  (await accounts[0].getAddress()).toString()
                              )
                              assert.equal(raffleState, 0)
                              assert(
                                  Number(endingTimeStamp) >
                                      Number(startingTimeStamp) + Number(interval)
                              )
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  (startingBalance + raffleEntranceFee).toString()
                              )
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(error)
                          }
                      })
                      console.log("Entering Raffle...")
                      const tx = await raffle.enterRaffle({ value: raffleEntranceFee })
                      await tx.wait(1)
                      console.log("Ok, time to wait...")
                      const startingBalance = await ethers.provider.getBalance(accounts[0])
                  })
              })
          })
      })
