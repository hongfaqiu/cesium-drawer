/*
 * @author: SkyBlue
 * @LastEditors: SkyBlue
 * @Date: 2020-09-25 09:38:05
 * @LastEditTime: 2020-10-09 10:57:20
 * @Gitee: https://gitee.com/skybluefeet
 * @Github: https://github.com/SkyBlueFeet
 */
// @ts-nocheck
import {
  Viewer,
  ScreenSpaceEventType,
  ScreenSpaceEventHandler,
  Entity,
  Cartesian2
} from 'cesium'

export interface EventArgs {
  position?: Cartesian2
  endPosition?: Cartesian2
  startPosition?: Cartesian2
  [name: string]: any
}
export type ListenCallback<T extends Entity> = (
  movement: EventArgs,
  substance: T
) => void

export type ExternalListenCallback = (movement: EventArgs) => void

// const eventType = ;

export type EventType =
  | 'LEFT_DOWN'
  | 'LEFT_UP'
  | 'LEFT_CLICK'
  | 'LEFT_DOUBLE_CLICK'
  | 'RIGHT_DOWN'
  | 'RIGHT_UP'
  | 'RIGHT_CLICK'
  | 'MIDDLE_DOWN'
  | 'MIDDLE_UP'
  | 'MIDDLE_CLICK'
  | 'MOUSE_MOVE'
  | 'WHEEL'
  | 'PINCH_START'
  | 'PINCH_MOVE'
  | 'PINCH_END'

type EventCollection = Record<EventType, Map<string, ListenCallback<Entity>>>

type ExternalEventCollection = Record<
  EventType,
  Map<string, ListenCallback<Entity>>
>

function uniqueId(): string {
  let _val = "";

  do {
    _val = Math.random()
      .toString(36)
      .slice(-8);
  } while (_val.length < 8);

  return _val;
}

export default class Subscriber {
  private _viewer: Viewer

  private _handler: ScreenSpaceEventHandler

  private _eventCollection: EventCollection = Object.create(null)

  private _externalEventCollection: ExternalEventCollection = Object.create({})

  private readonly _eventTypeList: EventType[] = [
    'LEFT_DOWN',
    'LEFT_UP',
    'LEFT_CLICK',
    'LEFT_DOUBLE_CLICK',
    'RIGHT_DOWN',
    'RIGHT_UP',
    'RIGHT_CLICK',
    'MIDDLE_DOWN',
    'MIDDLE_UP',
    'MIDDLE_CLICK',
    'MOUSE_MOVE',
    'WHEEL',
    'PINCH_START',
    'PINCH_MOVE',
    'PINCH_END'
  ]

  /**
   * 是否被销毁
   */
  get isDestroy() {
    return this._isDestroy
  }

  private _isDestroy: boolean

  constructor(viewer: Viewer, element?: HTMLCanvasElement) {
    this._viewer = viewer
    this._handler = new ScreenSpaceEventHandler(element || this._viewer.canvas)
    this._isDestroy = false
    this._initListener()
  }

  private _initListener(): void {
    this._eventTypeList.forEach(type => {
      this._eventCollection[type] = new Map()
      this._externalEventCollection[type] = new Map()
    })
  }

  private _eventRegister(eventType: EventType): void {
    if (this._isDestroy) return
    const eventCollection = this._eventCollection[eventType]
    const externalEventCollection = this._externalEventCollection[eventType]
    this._handler.setInputAction((movement: EventArgs) => {
      if (externalEventCollection.size > 0) {
        const iterator = externalEventCollection.values()
        let val = iterator.next()
        while (!val.done) {
          val.value(movement)
          val = iterator.next()
        }
      }

      if (this._isDestroy) return

      if (movement.position || movement.endPosition) {
        let entity: Entity;
        if (eventType === 'MOUSE_MOVE') {
          entity = this._viewer.scene.pick(movement.endPosition)?.id
        } else {
          entity = this._viewer.scene.pick(movement.position)?.id
        }
        if (
          entity &&
          eventCollection.has(entity.id) &&
          typeof eventCollection.get(entity.id) === 'function'
        ) {
          eventCollection.get(entity.id)(movement, entity)
        }
      }
    }, ScreenSpaceEventType[eventType])
  }

  /**
   * @description 为Entity添加监听事件
   *
   * @event
   *
   * @param {Function} callback 需要相应的事件
   *
   * @param {EventType} eventType 事件类型
   */
  add<T extends Entity>(
    substances: T | T[],
    callback: ListenCallback<T>,
    eventType: EventType
  ): void {
    if (this._isDestroy) return

    if (
      this._eventCollection[eventType].size === 0 &&
      this._externalEventCollection[eventType].size === 0
    )
      this._eventRegister(eventType)

    substances = Array.isArray(substances) ? substances : [substances]

    for (const substance of substances) {
      this._eventCollection[eventType].set(substance.id, callback)
    }
  }

  /**
   * @description 添加特定事件，与add不同在于该事件不会过滤Entity
   * @param callback 事件处理函数
   * @param eventType 事件类型
   * @return {string} Event Id  事件移除时需要提供事件ID
   */
  addExternal(callback: ExternalListenCallback, eventType: EventType): string {
    if (this._isDestroy) return

    if (
      this._eventCollection[eventType].size === 0 &&
      this._externalEventCollection[eventType].size === 0
    )
      this._eventRegister(eventType)

    const eId = uniqueId()
    this._externalEventCollection[eventType].set(eId, callback)
    return eId
  }

  /**
   *@description 移除指定Substance的相应事件
   * @param substances 需要移除事件的Substance
   * @param eventType 需要移除的时间类型
   */
  remove<T extends Entity>(substances: T | T[], eventType: EventType): void {
    if (this._isDestroy) return

    substances = Array.isArray(substances) ? substances : [substances]
    for (const substance of substances) {
      if (this._eventCollection[eventType].has(substance.id)) {
        this._eventCollection[eventType].delete(substance.id)
      }
    }
  }

  removeExternal(ids: string | string[], eventType?: EventType): void {
    if (this._isDestroy) return

    ids = Array.isArray(ids) ? ids : [ids]

    for (const id of ids) {
      const type = eventType || this._searchExternal(id)
      if (this._externalEventCollection[type]?.has(id)) {
        this._externalEventCollection[type].delete(id)
      }
    }
  }

  private _searchExternal(id: string): EventType {
    if (this._isDestroy) return

    const types: EventType[] = Object.keys(this._externalEventCollection) as any

    for (const type of types) {
      const events = this._externalEventCollection[type]
      if (events.has(id)) return type
    }
    return undefined
  }

  removeNative(viewer: Viewer, eventType: EventType): void {
    viewer.screenSpaceEventHandler.removeInputAction(
      this.convertCesiumEventType(eventType)
    )
  }

  private convertCesiumEventType(
    subscriberEventType: EventType
  ): ScreenSpaceEventType {
    return ScreenSpaceEventType[subscriberEventType]
  }

  destroy(): void {
    this._isDestroy = true
    this._externalEventCollection = undefined
    this._eventCollection = undefined
    this._viewer = undefined
    this._handler.destroy()

    // 销毁所有方法
    this.add = undefined
    this.addExternal = undefined
    this.remove = undefined
    this.removeExternal = undefined
    this.destroy = undefined
  }
}
