import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Plot} from "./plot.model"
import {Buyer} from "./buyer.model"

@Entity_()
export class PlotOperationRecord {
    constructor(props?: Partial<PlotOperationRecord>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Plot, {nullable: true})
    plot!: Plot

    @Column_("text", {nullable: false})
    txHash!: string

    @Column_("int4", {nullable: false})
    block!: number

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    timestamp!: bigint

    @Column_("text", {nullable: false})
    type!: string

    @Index_()
    @ManyToOne_(() => Buyer, {nullable: true})
    operator!: Buyer

    @Index_()
    @ManyToOne_(() => Buyer, {nullable: true})
    receiver!: Buyer | undefined | null

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: true})
    price!: bigint | undefined | null
}
