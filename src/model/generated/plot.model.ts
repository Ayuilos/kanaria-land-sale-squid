import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, OneToMany as OneToMany_} from "typeorm"
import * as marshal from "./marshal"
import {Buyer} from "./buyer.model"
import {Referrer} from "./referrer.model"
import {Sale} from "./sale.model"
import {PlotData} from "./_plotData"
import {PlotOperationRecord} from "./plotOperationRecord.model"

@Entity_()
export class Plot {
  constructor(props?: Partial<Plot>) {
    Object.assign(this, props)
  }

  @PrimaryColumn_()
  id!: string

  @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
  plotId!: bigint

  @Index_()
  @ManyToOne_(() => Buyer, {nullable: false})
  buyer!: Buyer

  @Index_()
  @ManyToOne_(() => Referrer, {nullable: false})
  referrer!: Referrer

  @Index_()
  @ManyToOne_(() => Sale, {nullable: false})
  sale!: Sale

  @Column_("jsonb", {transformer: {to: obj => obj.toJSON(), from: obj => new PlotData(undefined, marshal.nonNull(obj))}, nullable: false})
  data!: PlotData

  @Column_("int4", {nullable: false})
  lastModifiedBlock!: number

  @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
  lastModifiedTime!: bigint

  @OneToMany_(() => PlotOperationRecord, e => e.plot)
  operationRecords!: PlotOperationRecord[]
}
