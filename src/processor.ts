import { lookupArchive } from "@subsquid/archive-registry";
import { Store, TypeormDatabase } from "@subsquid/typeorm-store";
import {
  BatchContext,
  BatchProcessorItem,
  SubstrateBatchProcessor,
  SubstrateBlock,
} from "@subsquid/substrate-processor";
import { BigNumber } from "ethers";
import { EventItem } from "@subsquid/substrate-processor/lib/interfaces/dataSelection";
import { EntityManager } from "typeorm";

import {
  CHAIN_NODE,
  contractKanaria,
  contractKanariaNew,
  contractKanariaNewForRPC,
  contractRMRK,
} from "./contract";
import * as rmrk from "./abi/rmrk";
import * as kanaria from "./abi/kanaria";
import * as kanariaNew from "./abi/kanariaNew";
import {
  Buyer,
  Referrer,
  Sale,
  Plot,
  PlotOperationRecord,
  PlotData,
} from "./model";
import { concurrentFetch, getArgs, getTopic } from "./utils";

// types and interfaces
type Item = BatchProcessorItem<typeof processor>;
type Context = BatchContext<Store, Item>;

type GetTargetEvent<T extends keyof typeof kanariaNew.events> =
  typeof kanariaNew.events[T];
interface SaleTransaction {
  txHash: string;
  buyer: string;
  referrer: string;
  boughtWithCredits: boolean;
  plotIds: BigNumber[];
  amount: bigint;
  timestamp: number;
  block: number;
}

interface PlotOperationTransaction {
  txHash: string;
  block: number;
  timestamp: number;
  plotId: string;
  seller: string;
  buyer?: string;
  price?: BigNumber;
  type: "LIST" | "CHANGE_PRICE" | "CANCEL" | "FULFILL" | "TRANSFER";
}

interface TransferTransaction {
  txHash: string;
  value: bigint;
}

// processor setup
const database = new TypeormDatabase();
const processor = new SubstrateBatchProcessor()
  // the old landsale contract's deployment block is 2028508
  .setBlockRange({ from: 2028500 })
  .setBatchSize(150)
  .setDataSource({
    chain: CHAIN_NODE,
    archive: lookupArchive("moonriver", { release: "FireSquid" }),
  })
  .setTypesBundle("moonriver")
  .addEvmLog(contractKanaria.address, {
    filter: [
      kanaria.events["PlotsBought(uint256[],address,address,bool)"].topic,
    ],
  })
  .addEvmLog(contractKanariaNew.address, {
    filter: [
      [
        kanariaNew.events["PlotsBought(uint256[],address,address,bool)"].topic,
        kanariaNew.events["PlotListed(uint256,address,uint256)"].topic,
        kanariaNew.events["PlotPriceChanged(uint256,address,uint256,uint256)"]
          .topic,
        kanariaNew.events["PlotDelisted(uint256,address)"].topic,
        kanariaNew.events["PlotPurchased(uint256,address,address,uint256)"]
          .topic,
        kanariaNew.events["PlotTransferred(uint256,address,address)"].topic,
      ],
    ],
  })
  .addEvmLog(contractRMRK.address, {
    filter: [rmrk.events["Transfer(address,address,uint256)"].topic],
  });

processor.run(database, processBatches);

// processor functions

async function processBatches(ctx: Context) {
  // create map stores for saleTransactions and transferTransactions
  const saleTransactions = new Map<string, SaleTransaction>();
  const plotOperationTransactions = new Map<string, PlotOperationTransaction>();
  const transferTransactions = new Map<string, TransferTransaction>();

  // looping through blocks and items within each block
  for (const block of ctx.blocks) {
    for (const item of block.items) {
      if (item.name === "EVM.Log") {
        // create a saleTransaction for each PlotsBought event log, and populate the map
        const args = getArgs(item.event);

        if (
          args.address === contractKanaria.address ||
          args.address === contractKanariaNew.address
        ) {
          handlePlotsBoughtEvents(item, saleTransactions, block.header);
          handlePlotsModifiedEvents(
            item,
            plotOperationTransactions,
            block.header
          );
        }
        // create a transferTransaction for each RMRK Transfer event log, and populate the map
        else if (args.address === contractRMRK.address) {
          handleXcRMRKTransferEvents(item, transferTransactions);
        }
      }
    }
  }
  // log the transfer values to saleTransactions, then create entities to save / persist
  processTransfers(ctx, saleTransactions, transferTransactions);
  await saveEntities(ctx, saleTransactions, plotOperationTransactions);
}

function handlePlotsBoughtEvents(
  item: EventItem<"EVM.Log", true>,
  saleTransactions: Map<string, SaleTransaction>,
  blockHeader: SubstrateBlock
) {
  const { height, timestamp } = blockHeader;
  const txHash = item.event.evmTxHash;
  const topic = getTopic(item.event);
  const eventsList = [
    kanaria.events["PlotsBought(uint256[],address,address,bool)"],
    kanariaNew.events["PlotsBought(uint256[],address,address,bool)"],
  ];
  const targetEvent = eventsList.find((event) => event.topic === topic);

  if (targetEvent) {
    const bought = targetEvent.decode(getArgs(item.event));
    const saleTransaction = {
      txHash,
      buyer: bought.buyer,
      referrer: bought.referrer,
      boughtWithCredits: bought.boughtWithCredits,
      plotIds: bought.plotIds,
      amount: 0n,
      timestamp,
      block: height,
    } as SaleTransaction;
    saleTransactions.set(
      `${
        saleTransaction.txHash
      }_${saleTransaction.boughtWithCredits.toString()}`,
      saleTransaction
    );
  }
}

function handlePlotsModifiedEvents(
  item: EventItem<"EVM.Log", true>,
  plotOperationTransactions: Map<string, PlotOperationTransaction>,
  blockHeader: SubstrateBlock
) {
  const { height, timestamp } = blockHeader;
  const txHash = item.event.evmTxHash;
  const topic = getTopic(item.event);

  const eventsList: GetTargetEvent<
    | "PlotListed(uint256,address,uint256)"
    | "PlotPriceChanged(uint256,address,uint256,uint256)"
    | "PlotDelisted(uint256,address)"
    | "PlotPurchased(uint256,address,address,uint256)"
    | "PlotTransferred(uint256,address,address)"
  >[] = [
    kanariaNew.events["PlotListed(uint256,address,uint256)"],
    kanariaNew.events["PlotPriceChanged(uint256,address,uint256,uint256)"],
    kanariaNew.events["PlotDelisted(uint256,address)"],
    kanariaNew.events["PlotPurchased(uint256,address,address,uint256)"],
    kanariaNew.events["PlotTransferred(uint256,address,address)"],
  ];
  const targetEvent = eventsList.find((event) => event.topic === topic);

  if (targetEvent) {
    const eArgs = getArgs(item.event);

    switch (targetEvent.topic) {
      case eventsList[0].topic: {
        const args = (
          targetEvent as GetTargetEvent<"PlotListed(uint256,address,uint256)">
        ).decode(eArgs);
        const plotId = args.plotId.toString();
        const { seller, price } = args;

        plotOperationTransactions.set(txHash, {
          plotId,
          seller,
          price,
          txHash,
          block: height,
          timestamp,
          type: "LIST",
        });
        break;
      }
      case eventsList[1].topic: {
        const args = (
          targetEvent as GetTargetEvent<"PlotPriceChanged(uint256,address,uint256,uint256)">
        ).decode(eArgs);
        const plotId = args.plotId.toString();
        const { seller, newPrice } = args;

        plotOperationTransactions.set(txHash, {
          plotId,
          seller,
          price: newPrice,
          txHash,
          block: height,
          timestamp,
          type: "CHANGE_PRICE",
        });
        break;
      }
      case eventsList[2].topic: {
        const args = (
          targetEvent as GetTargetEvent<"PlotDelisted(uint256,address)">
        ).decode(eArgs);
        const plotId = args.plotId.toString();
        const { seller } = args;

        plotOperationTransactions.set(txHash, {
          plotId,
          seller,
          txHash,
          type: "CANCEL",
          block: height,
          timestamp,
        });
        break;
      }
      case eventsList[3].topic: {
        const args = (
          targetEvent as GetTargetEvent<"PlotPurchased(uint256,address,address,uint256)">
        ).decode(eArgs);
        const plotId = args.plotId.toString();
        const { price, seller, buyer } = args;

        plotOperationTransactions.set(txHash, {
          plotId,
          seller,
          buyer,
          price,
          txHash,
          type: "FULFILL",
          block: height,
          timestamp,
        });
        break;
      }
      case eventsList[4].topic: {
        const args = (
          targetEvent as GetTargetEvent<"PlotTransferred(uint256,address,address)">
        ).decode(eArgs);
        const { plotIds: plotId, oldOwner, newOwner } = args;

        plotOperationTransactions.set(txHash, {
          block: height,
          timestamp,
          seller: oldOwner,
          buyer: newOwner,
          txHash,
          plotId: plotId.toString(),
          type: "TRANSFER",
        });

        break;
      }
      default:
    }
  }
}

function handleXcRMRKTransferEvents(
  item: EventItem<"EVM.Log", true>,
  transferTransactions: Map<string, TransferTransaction>
) {
  const txHash = item.event.evmTxHash;
  const args = getArgs(item.event);
  const topic = args.topic;

  if (topic === rmrk.events["Transfer(address,address,uint256)"].topic) {
    const transfer =
      rmrk.events["Transfer(address,address,uint256)"].decode(args);
    if (!transferTransactions.has(txHash)) {
      const transferTransaction = {
        txHash,
        value: 0n,
      } as TransferTransaction;
      transferTransactions.set(txHash, transferTransaction);
    }
    transferTransactions.get(txHash)!.value += transfer.value.toBigInt();
  }
}

function processTransfers(
  ctx: Context,
  saleTransactions: Map<string, SaleTransaction>,
  transferTransactions: Map<string, TransferTransaction>
) {
  for (const [id, saleTransaction] of saleTransactions.entries()) {
    const [txHash, boughtWithCredits] = id.split("_");
    if (boughtWithCredits === "false") {
      if (transferTransactions.has(txHash)) {
        saleTransaction.amount = transferTransactions.get(txHash)!.value;
      }
    }
  }
}

async function saveEntities(
  ctx: Context,
  saleTransactions: Map<string, SaleTransaction>,
  plotOperationTransactions: Map<string, PlotOperationTransaction>
) {
  // create map stores
  const buyers = new Map<string, Buyer>();
  const referrers = new Map<string, Referrer>();
  const sales = new Map<string, Sale>();
  const plots = new Map<string, Plot>();
  const plotOperationRecords = new Map<string, PlotOperationRecord>();

  async function setSecondMarketUserAsBuyer(buyer = "") {
    if (!(await ctx.store.get(Buyer, buyer))) {
      await ctx.store.insert(new Buyer({ id: buyer }));
    }
  }

  // get plot data
  const pIds = [...saleTransactions.values()].reduce((_pIds, trans) => {
    _pIds.push(...trans.plotIds);

    return _pIds;
  }, [] as BigNumber[]);
  const plotDatas = await concurrentFetch({
    fetcher: contractKanariaNewForRPC.functions.getPlotData,
    data: pIds,
    dataResolver: (_data) => {
      const {
        cyber,
        steampunk,
        wind,
        volcano,
        fire,
        water,
        necro,
        mecha,
        dragon,
        meadow,
        isShore,
        isIsland,
        isMountainFoot,
        rarity,
        entropy,
      } = _data[0];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return new PlotData({
        cyber,
        steampunk,
        wind,
        volcano,
        fire,
        water,
        necro,
        mecha,
        dragon,
        meadow,
        isShore,
        isIsland,
        isMountainFoot,
        rarity,
        entropy,
      });
    },
  });
  const plotDataMap = new Map(
    pIds.map((pId, i) => {
      return [pId, plotDatas[i]];
    })
  );

  // for each saleTransaction, create relevant entities
  for (const saleTransaction of saleTransactions.values()) {
    // create Buyer
    let buyer = await ctx.store.get(Buyer, saleTransaction.buyer);
    if (!buyer) {
      buyer = new Buyer({ id: saleTransaction.buyer });
    }
    buyers.set(buyer.id, buyer);

    // create Referrer
    let referrer = await ctx.store.get(Referrer, saleTransaction.referrer);
    if (!referrer) {
      referrer = new Referrer({ id: saleTransaction.referrer });
    }
    referrers.set(referrer.id, referrer);

    // create Sale
    let sale = await ctx.store.get(
      Sale,
      `${
        saleTransaction.txHash
      }_${saleTransaction.boughtWithCredits.toString()}`
    );
    if (!sale) {
      sale = new Sale({
        id: `${
          saleTransaction.txHash
        }_${saleTransaction.boughtWithCredits.toString()}`,
        txHash: saleTransaction.txHash,
        amount: saleTransaction.amount,
        buyer,
        referrer,
        boughtWithCredits: saleTransaction.boughtWithCredits,
        timestamp: BigInt(saleTransaction.timestamp),
        block: saleTransaction.block,
      });
    }
    sales.set(sale.id, sale);

    // create Plots
    for (const plotId of saleTransaction.plotIds) {
      let plot = await ctx.store.get(Plot, plotId.toString());
      if (!plot) {
        plot = new Plot({
          id: plotId.toString(),
          plotId: plotId.toBigInt(),
          buyer,
          owner: buyer,
          referrer,
          sale,
          lastModifiedBlock: sale.block,
          lastModifiedTime: sale.timestamp,
          data: plotDataMap.get(plotId),
        });
      }
      plots.set(plot.id, plot);
    }
  }

  for (const plotOperationTransaction of plotOperationTransactions.values()) {
    const { plotId, block, timestamp, price, seller, buyer, txHash, type } =
      plotOperationTransaction;

    // The buyer could be whom DID NOT buy plot from official
    // So they are not in `buyers` now
    // have to find these guys to `buyers` from operationTransaction
    await setSecondMarketUserAsBuyer(buyer);

    // get operation on db
    let operation = await ctx.store.get(PlotOperationRecord, plotId);
    // if no
    if (!operation) {
      const plotInDB = await ctx.store.get(Plot, plotId);
      const plot = (plotInDB ?? plots.get(plotId))!;

      operation = new PlotOperationRecord({
        id: plotOperationTransaction.txHash,
        plot,
        price: price ? price.toBigInt() : null,
        operator: ((await ctx.store.get(Buyer, seller)) ?? buyers.get(seller))!,
        receiver: buyer
          ? (await ctx.store.get(Buyer, buyer)) ?? buyers.get(buyer)
          : null,
        block,
        timestamp: BigInt(timestamp),
        txHash,
        type,
      });

      // if this operation was newer than plot is recording, update plot's record
      if (plot && plot.lastModifiedBlock < operation.block) {
        const updatedData: Partial<Plot> = {
          lastModifiedBlock: operation.block,
          lastModifiedTime: operation.timestamp,
        };
        if (operation.receiver) {
          updatedData.owner = operation.receiver;
        }
        // if in db, just update it
        if (plotInDB) {
          // add @ts-ignore here to use private variable forcely
          // to avoid build error which will stop docker running

          // @ts-ignore
          await ctx.store.em().then((em: EntityManager) => {
            return em.update(Plot, plotId, updatedData);
          });
        } else {
          // if not, update it in map
          Object.assign(plot, updatedData);

          plots.set(plotId, plot);
        }
      }

      plotOperationRecords.set(operation.id, operation);
    }
  }

  // change plot buyer when last record of bid has been fulfill or plot has transferred

  // batch saving / persisting the entities
  await ctx.store.save([...buyers.values()]);
  await ctx.store.save([...referrers.values()]);
  await ctx.store.save([...sales.values()]);
  await ctx.store.save([...plots.values()]);
  await ctx.store.save([...plotOperationRecords.values()]);
}
