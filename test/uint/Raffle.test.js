const { network, ethers, deployments } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle unit tests", function () {
          let deployer, vrfCoordinatorV2Mock, raffleContract, raffle, raffleEntranceFee, interval
          beforeEach(async () => {
              accounts = await ethers.getSigners()
              // Try this: player = (await getNamedaccounts()).player
              deployer = accounts[0]
              //   console.log(await deployer.getAddress())
              await deployments.fixture(["mocks", "raffle"])
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
              raffleContract = await ethers.getContract("Raffle")
              raffle = raffleContract.connect(deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("constructor", function () {
              it("initializes the raffle correctly", async () => {
                  const raffleState = (await raffle.getRaffleState()).toString()
                  assert.equal(raffleState, "0")
                  assert.equal(
                      interval.toString(),
                      networkConfig[network.config.chainId]["interval"]
                  )
              })
          })

          describe("enterRaffle", function () {
              it("revert when you dont pay enough", async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__SendMoreToEnterRaffle"
                  )
              })
              it("records players when they enter", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerEnter = await raffle.getPlayer(0)
                  assert.equal(playerEnter, await deployer.getAddress())
              })
              it("emit event on enter", async () => {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })
              it("doesnt allow entrance when raffle is calculating", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })

                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine")
                  await raffle.performUpkeep("0x")
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.be.revertedWithCustomError(raffle, "Raffle__RaffleNotOpen")
              })
          })

          describe("checkUpkeep", function () {
              it("returns false if people dont send ETH", async () => {
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine")
                  //   const { upkeepNeeded } = await raffle.callstatic.checkUpkeep([])
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  assert(!upkeepNeeded)
              })
              it("return false if raffle not open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine")
                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upkeepNeeded, false)
              })
              it("return false if time hasnt pass", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) - 2])
                  await network.provider.send("evm_mine")
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  assert(!upkeepNeeded)
              })
              it("returns true if all condition meet", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 2])
                  await network.provider.send("evm_mine")
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  assert(upkeepNeeded)
              })
          })

          describe("performUpkeep", function () {
              it("it can only run if checkUpkeep return true", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine")
                  const tx = raffle.performUpkeep("0x")
                  assert(tx)
              })
              it("reverts when checkUpkeep is false", async () => {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpkeepNotNeeded"
                  )
              })
              it("updates the raffle state, emits an event, and calls the vrf coordinator", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine")
                  const txResponse = await raffle.performUpkeep("0x")
                  const txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.logs[1].args.requestId
                  //   console.log(txReceipt.logs[1])
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState, "1")
                  assert(Number(requestId) > 0)
              })
          })

          describe("fulfillRandomWords", function () {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine")
              })
              it("can only be called after performUpkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.getAddress())
                  ).to.be.revertedWith("nonexistent request")
              })
              it("emits WinnerPicked event when call", async () => {
                  const tx = await raffle.performUpkeep("0x")
                  const txReceipt = await tx.wait(1)
                  const requestId = txReceipt.logs[1].args.requestId
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.getAddress())
                  ).to.emit(raffle, "WinnerPicked")
              })
              it("picks a winner, resets the lottery, and sends money, all at once", async () => {
                  const additionPlayers = 3
                  const startingPlayerIndex = 1
                  for (
                      let i = startingPlayerIndex;
                      i < additionPlayers + startingPlayerIndex;
                      i++
                  ) {
                      const playerConnect = raffleContract.connect(accounts[i])
                      await playerConnect.enterRaffle({
                          value: raffleEntranceFee,
                      })
                  }
                  const startingTimeStamp = await raffle.getLastTimeStamp()

                  const txResponse = await raffle.performUpkeep("0x")
                  const txReceipt = await txResponse.wait(1)
                  const startingBalance = await ethers.provider.getBalance(accounts[1])
                  const requestId = txReceipt.logs[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.getAddress())

                  const raffleState = await raffle.getRaffleState()
                  const endingTimeStamp = await raffle.getLastTimeStamp()
                  const numPlayers = await raffle.getNumberOfPlayers()
                  const winnerBalance = await ethers.provider.getBalance(accounts[1])
                  assert.equal(numPlayers.toString(), "0")
                  assert.equal(raffleState.toString(), "0")
                  assert(Number(endingTimeStamp) > Number(startingTimeStamp) + Number(interval))
                  assert.equal(
                      winnerBalance.toString(),
                      (
                          startingBalance +
                          (raffleEntranceFee * BigInt(additionPlayers) + raffleEntranceFee)
                      ).toString()
                  )
              })
          })
      })
