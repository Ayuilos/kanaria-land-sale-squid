import assert from "assert"
import * as marshal from "./marshal"

export class PlotData {
  private _cyber!: number
  private _steampunk!: number
  private _wind!: number
  private _volcano!: number
  private _fire!: number
  private _water!: number
  private _necro!: number
  private _mecha!: number
  private _dragon!: number
  private _meadow!: number
  private _isShore!: number
  private _isIsland!: number
  private _isMountainFoot!: number
  private _rarity!: number
  private _entropy!: number

  constructor(props?: Partial<Omit<PlotData, 'toJSON'>>, json?: any) {
    Object.assign(this, props)
    if (json != null) {
      this._cyber = marshal.int.fromJSON(json.cyber)
      this._steampunk = marshal.int.fromJSON(json.steampunk)
      this._wind = marshal.int.fromJSON(json.wind)
      this._volcano = marshal.int.fromJSON(json.volcano)
      this._fire = marshal.int.fromJSON(json.fire)
      this._water = marshal.int.fromJSON(json.water)
      this._necro = marshal.int.fromJSON(json.necro)
      this._mecha = marshal.int.fromJSON(json.mecha)
      this._dragon = marshal.int.fromJSON(json.dragon)
      this._meadow = marshal.int.fromJSON(json.meadow)
      this._isShore = marshal.int.fromJSON(json.isShore)
      this._isIsland = marshal.int.fromJSON(json.isIsland)
      this._isMountainFoot = marshal.int.fromJSON(json.isMountainFoot)
      this._rarity = marshal.int.fromJSON(json.rarity)
      this._entropy = marshal.int.fromJSON(json.entropy)
    }
  }

  get cyber(): number {
    assert(this._cyber != null, 'uninitialized access')
    return this._cyber
  }

  set cyber(value: number) {
    this._cyber = value
  }

  get steampunk(): number {
    assert(this._steampunk != null, 'uninitialized access')
    return this._steampunk
  }

  set steampunk(value: number) {
    this._steampunk = value
  }

  get wind(): number {
    assert(this._wind != null, 'uninitialized access')
    return this._wind
  }

  set wind(value: number) {
    this._wind = value
  }

  get volcano(): number {
    assert(this._volcano != null, 'uninitialized access')
    return this._volcano
  }

  set volcano(value: number) {
    this._volcano = value
  }

  get fire(): number {
    assert(this._fire != null, 'uninitialized access')
    return this._fire
  }

  set fire(value: number) {
    this._fire = value
  }

  get water(): number {
    assert(this._water != null, 'uninitialized access')
    return this._water
  }

  set water(value: number) {
    this._water = value
  }

  get necro(): number {
    assert(this._necro != null, 'uninitialized access')
    return this._necro
  }

  set necro(value: number) {
    this._necro = value
  }

  get mecha(): number {
    assert(this._mecha != null, 'uninitialized access')
    return this._mecha
  }

  set mecha(value: number) {
    this._mecha = value
  }

  get dragon(): number {
    assert(this._dragon != null, 'uninitialized access')
    return this._dragon
  }

  set dragon(value: number) {
    this._dragon = value
  }

  get meadow(): number {
    assert(this._meadow != null, 'uninitialized access')
    return this._meadow
  }

  set meadow(value: number) {
    this._meadow = value
  }

  get isShore(): number {
    assert(this._isShore != null, 'uninitialized access')
    return this._isShore
  }

  set isShore(value: number) {
    this._isShore = value
  }

  get isIsland(): number {
    assert(this._isIsland != null, 'uninitialized access')
    return this._isIsland
  }

  set isIsland(value: number) {
    this._isIsland = value
  }

  get isMountainFoot(): number {
    assert(this._isMountainFoot != null, 'uninitialized access')
    return this._isMountainFoot
  }

  set isMountainFoot(value: number) {
    this._isMountainFoot = value
  }

  get rarity(): number {
    assert(this._rarity != null, 'uninitialized access')
    return this._rarity
  }

  set rarity(value: number) {
    this._rarity = value
  }

  get entropy(): number {
    assert(this._entropy != null, 'uninitialized access')
    return this._entropy
  }

  set entropy(value: number) {
    this._entropy = value
  }

  toJSON(): object {
    return {
      cyber: this.cyber,
      steampunk: this.steampunk,
      wind: this.wind,
      volcano: this.volcano,
      fire: this.fire,
      water: this.water,
      necro: this.necro,
      mecha: this.mecha,
      dragon: this.dragon,
      meadow: this.meadow,
      isShore: this.isShore,
      isIsland: this.isIsland,
      isMountainFoot: this.isMountainFoot,
      rarity: this.rarity,
      entropy: this.entropy,
    }
  }
}
