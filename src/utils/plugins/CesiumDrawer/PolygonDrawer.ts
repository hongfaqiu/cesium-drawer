import * as Cesium from 'cesium';

import { Cartesian2, Cartesian3, Entity, LabelCollection, Viewer } from 'cesium';
import Subscriber, { EventArgs } from './subscriber';

type PolygonDrawerOptions = {
  accuracy?: number;
  once?: boolean;
  retainGeo?: boolean;
  positions?: Cartesian3[]; // an empty array
  callback?: (coors: number[][]) => void;
  posChange?: (coors: number[][]) => void;
  tips?: {
    leftClick?: string;
    rightClick?: string;
    doubleClick?: string;
    edit?: string;
  }
}
export default class PolygonDrawer {
  private _viewer: Viewer;
  private _callBack: ((coors: number[][]) => void) | undefined;
  private _posChange: ((coors: number[][]) => void) | undefined;
  private _pointGeometry: Entity[] = [];
  private _activePoint: Entity | null = null;
  private _polygon: Entity | null = null;
  private _positions: Cartesian3[] = [];
  private _status: 'INIT' | 'START' | 'END' | 'EDITING' | "DESTROY";
  private _mouseDelta = 10;
  private _lastClickPosition: Cartesian2 = new Cesium.Cartesian2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  private _options: PolygonDrawerOptions = {
    accuracy: 6,
    once: true,
    retainGeo: true,
  }
  private _subscriber: Subscriber;
  private _events: string[] = [];
  private _labels: LabelCollection;
  private _tips = {
    leftClick: 'LeftClick to add point',
    rightClick: 'RightClick cancel',
    doubleClick: 'DoubleClick compleate',
    edit: 'LeftClick to edit',
  }
  private _hoveredPoint: Entity | null = null;

  get status() {
    return this._status;
  }

  get isDestroy() {
    return this._status === 'DESTROY'
  }

  /**
   * Create a PolygonDrawer Class
   * @param viewer cesium viewer
   * @param [options.accuracy] lonlat number accuracy.
   * @param [options.once] If continue to draw the next polygon.
   * @param [options.retainGeo] If retain polygon geo after drawing complete.
   * @param [options.positions] The object onto which to store the position Array.
   * @param [options.callback] callback funciton after drawing complete.
   * @param [options.posChange] callback funciton after position array changed.
   * @param [options.tips] tip labels text config.
   * @example
   * const DrawTool = new PolygonDrawer(viewer, {
      callback: (result) => {
        console.log(result);
      },
      posChange: (coors) => {
        console.log(coors)
      },
      tips: {
        leftClick: intl.formatMessage({ id: 'drawer.leftClick' }),
        rightClick: intl.formatMessage({ id: 'drawer.rightClick' }),
        doubleClick: intl.formatMessage({ id: 'drawer.doubleClick' }),
        edit: intl.formatMessage({ id: 'drawer.edit' }),
      }
    })
   */
  constructor(viewer: Viewer, options?: PolygonDrawerOptions) {
    if (!viewer) throw new Error('no viewer object');
    this._viewer = viewer;
    this._callBack = options?.callback;
    this._posChange = options?.posChange;
    this._options = { ...this._options, ...options };
    if (options?.positions instanceof Array) {
      this._positions = options.positions;
    }
    this._tips = { ...this._tips, ...options?.tips };

    this._status = 'INIT';
    if (!this._viewer.scene.pickPositionSupported) {
      console.warn(
        '?????????????????? pickPosition???????????????????????????????????????????????????'
      )
    }
    this._labels = new LabelCollection();
    viewer.scene.primitives.add(this._labels);
    this._labels.add({
      text: 'start',
      font: `bold 1rem Arial`,
      fillColor: Cesium.Color.WHITE,
      backgroundColor: Cesium.Color.fromCssColorString('#000000'),
      backgroundPadding: new Cesium.Cartesian2(4, 4),
      outlineWidth: 4,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(4, 30),
      scale: 1,
      scaleByDistance: new Cesium.NearFarScalar(1, 0.85, 8.0e6, .75)
    });
    this._subscriber = new Subscriber(this._viewer);
  }

  /**
   * ??????????????????
   * @param options ?????????????????????????????? ?????????????????????????????????
   */
  private updateLabel(options: {
    position?: Cartesian3;
    text?: string;
    show?: boolean;
  } | undefined = undefined) {
    const label = this._labels.get(0);
    if (!label) return;
    if (!options) {
      if (!this._activePoint) {
        label.show = false;
        return;
      }
      label.show = true;

      const { leftClick, rightClick, doubleClick } = this._tips;
      let tip = `${leftClick}, ${rightClick}` ;
      const num = this._positions.length;
      if (num > 2) tip = `${leftClick}, ${rightClick}, ${doubleClick}`;
      label.text = tip;
      return;
    }

    const { position, text, show = true } = options;
    if (position) label.position = position;
    if (text !== undefined) {
      label.text = text;
    }
    label.show = show
  }

  /**
   * positions?????????????????????????????????
   */
  private handlePosChange = () => {
    if (this._posChange) {
      const pos: number[][] = [];
      const posIndex = this._activePoint ? this._pointGeometry.indexOf(this._activePoint) : -1;
      this._positions.map((item, index) => {
        // ???????????????????????????
        if(index !== posIndex) pos.push(this.cartesian2lonlat(item))
      })
      this._posChange(pos);
    }
  }

  protected drawPoint(position: Cartesian3) {
    const pointGeometry = this._viewer.entities.add({
      position,
      point: {
        color: Cesium.Color.SKYBLUE,
        pixelSize: 10,
        outlineColor: Cesium.Color.YELLOW,
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    this._viewer.scene.requestRender();
    return pointGeometry;
  }

  private updatePointSize(entity: Entity, size: number) {
    if(entity.point) (entity.point.pixelSize as any).setValue(size);
  }

  /**
   * ???Entity?????????????????????
   */
  private onMouseClickPoint = (movement: EventArgs, entity: Entity) => {
    if (this._status === 'EDITING' && this._activePoint) {
      return;
    }
    const index = this._pointGeometry.indexOf(entity);
    this.activeOnePosition(index);
    this._status = 'EDITING';
  }

  /**
   * ???????????????
   */
  private drawShape = (hierarchy: Cesium.Cartesian3[] | Cesium.CallbackProperty) => {
    //???positionData???????????????????????????????????????function??????????????????
    const shape = this._viewer.entities.add({
      polygon: {
        hierarchy: Array.isArray(hierarchy)
        ? new Cesium.PolygonHierarchy(hierarchy)
        : hierarchy,
        material: Cesium.Color.YELLOW.withAlpha(0.5)
      }
    });
    this._polygon = shape;
    this._viewer.scene.requestRender();
    return shape;
  }

  /**
   * ??????????????????????????????????????????position?????????
   */
  private handleMouseMove = (movement: EventArgs) => {
    const { ellipsoid } = this._viewer.scene.globe;
    if (!movement.endPosition) return;
    const newPosition = this._viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);

    // ????????????????????????????????????????????????
    if (this._status === 'END') {
      const entity = this._viewer.scene.pick(movement.endPosition)?.id
      if (this._hoveredPoint && this._hoveredPoint !== entity) {
        this.updatePointSize(this._hoveredPoint, 5);
        this._hoveredPoint = null;
        this.updateLabel({
          show: false
        })
        this._viewer.canvas.style.cursor = 'default';
      }
      if (!this._hoveredPoint && this._pointGeometry.indexOf(entity) !== -1) {
        this._hoveredPoint = entity;
        this.updatePointSize(entity, 10);
        this.updateLabel({
          position: newPosition,
          text: this._tips.edit,
          show: true
        })
        this._viewer.canvas.style.cursor = 'pointer';
      }
      return;
    }

    if (!this._activePoint) return;
    (this._activePoint.position as any).setValue(newPosition);
    const index = this._pointGeometry.indexOf(this._activePoint);
    if (this._positions.length >= 2 && newPosition) {
      this._positions.splice(index, 1, newPosition);
    }
    this.updateLabel({
      position: newPosition
    })
    this._viewer.scene.requestRender();
  }

  /**
   * ????????????????????????,????????????????????????,????????????????????????
   */
  private handleMouseLeftClick = (movement: EventArgs) => {
    if (!movement.position || !this._activePoint) return;
    const { ellipsoid } = this._viewer.scene.globe;
    const cartesian = this._viewer.camera.pickEllipsoid(movement.position, ellipsoid);
    if (!cartesian || !Cesium.defined(cartesian)) return;
    // ???????????????????????????????????????return
    if (this._lastClickPosition && Cesium.Cartesian2.magnitude(Cesium.Cartesian2.subtract(this._lastClickPosition, movement.position, {} as any)) < this._mouseDelta) return;

    const index = this._pointGeometry.indexOf(this._activePoint);
    const pointGeo = this.drawPoint(cartesian);
    this.updatePointSize(this._activePoint, 5);
    this._activePoint = pointGeo;
    this._pointGeometry.splice(index + 1, 0, pointGeo);
    this._positions.splice(index + 1, 0, cartesian);
    Cesium.Cartesian2.clone(movement.position, this._lastClickPosition)

    if (this._positions.length === 1) {
      this._positions.push(cartesian);
      const dynamicPositions = new Cesium.CallbackProperty(
        () => new Cesium.PolygonHierarchy(this._positions),
        false
      )
      this.removePolygon();
      this.drawShape(dynamicPositions);//???????????????
    }
    this.updateLabel();
    this.handlePosChange();
  }

  /**
   * ???????????????
   * @param index ????????????
   * @param pos ???????????????
   */
  addOnePosition = (index: number, pos: number[]) => {
    if (!Array.isArray(pos)) return false;
    const position = Cesium.Cartesian3.fromDegrees(pos[0], pos[1]);
    const pointGeo = this.drawPoint(position);
    this.updatePointSize(pointGeo, 5);
    this._subscriber.add(pointGeo, this.onMouseClickPoint, 'LEFT_CLICK');
    this._positions.splice(index, 0, position);
    this._pointGeometry.splice(index, 0, pointGeo);
    this.handlePosChange();
    this._viewer.scene.requestRender();
    return true;
  }

  /**
   * ??????????????????????????????
   * @param index ?????????
   * @param pos ??????[?????????]
   * @returns boolean
   */
  changeOnePosition = (index: number, pos: number[]) => {
    if (!Array.isArray(pos)) return false;
    const position = Cesium.Cartesian3.fromDegrees(pos[0], pos[1]);
    this._positions[index] = position;
    (this._pointGeometry[index].position as any).setValue(position);
    return true;
  }

  /**
   * ???????????????
   * @param index ????????????
   * @returns {boolean} ??????????????????
   */
  removeOnePosition = (index: number) => {
    const length = this._positions.length
    // ?????????????????????3,???????????????
    if (length <= 2) return false;
    const pointGeo = this._pointGeometry[index];
    if (this._status === 'EDITING') {
      this._subscriber.remove(pointGeo, 'LEFT_CLICK');
    }
    this._viewer.entities.remove(pointGeo);
    this._positions.splice(index, 1);
    this._pointGeometry.splice(index, 1);
    this.handlePosChange();
    this._viewer.scene.requestRender();
    return true;
   }

  /**
   * ??????????????????????????????
   * @param index ????????????
   */
  activeOnePosition = (index: number) => {
    const pointGeo = this._pointGeometry[index];
    this._activePoint = pointGeo;
    this.updatePointSize(this._activePoint, 10);
    this.updateLabel();
    this._viewer.scene.requestRender();
  }

  // ????????????????????????
  private handleMouseRightClick = () => {
    if (!this._activePoint) return;
    const index = this._pointGeometry.indexOf(this._activePoint);
    if (index <= 0) return;
    this.removeOnePosition(index - 1)
    this.updateLabel();
  }

  /**
   * ?????????????????????
   */
  start() {
    this.stop();
    this._pointGeometry = [];
    const position = this._positions[1] ?? new Cesium.Cartesian3();
    const firstPoint = this.drawPoint(position);
    this._positions.length = 0;
    this._pointGeometry.push(firstPoint);
    this._activePoint = firstPoint;
    this._subscriber.removeNative(this._viewer, 'LEFT_DOUBLE_CLICK');

    if (this._events.length === 0) {
      const startId = this._subscriber.addExternal(this.handleMouseLeftClick, 'LEFT_CLICK');
      const moveId = this._subscriber.addExternal(this.handleMouseMove, 'MOUSE_MOVE');
      const cancelId = this._subscriber.addExternal(this.handleMouseRightClick, 'RIGHT_CLICK');
      const endId = this._subscriber.addExternal(this.endDraw, 'LEFT_DOUBLE_CLICK');

      this._events = [startId, moveId, cancelId, endId];
    }
    this.updateLabel();
    this._status = 'START';
    this.handlePosChange();
  }

  private removePolygon = () => {
    if (this._polygon) {
      this._viewer.entities.remove(this._polygon);
      this._polygon = null;
    }
  }

  /**
   * ?????????????????????
   * @param removePoint ?????????????????????,??????true
   */
  private stop(removePoint: boolean = true) {
    if (removePoint) {
      this._subscriber.remove(this._pointGeometry, 'LEFT_CLICK');
      this._pointGeometry.map(entity => {
        this._viewer.entities.remove(entity);
      })
      this._pointGeometry = [];
    }

    // ????????????????????????
    if (this._activePoint) {
      const index = this._pointGeometry.indexOf(this._activePoint);
      if (this._activePoint) this._viewer.entities.remove(this._activePoint);
      this._pointGeometry.splice(index, 1)
      this._activePoint = null;
    }

    this._status = 'END';
    this._lastClickPosition = new Cesium.Cartesian2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    this._viewer.scene.requestRender();
    return true;
  }


  /**
   * cesium??????????????????
   * @param cartesian
   * @returns [lon, lat]
   */
  cartesian2lonlat = (cartesian: Cartesian3) => {
    if (!cartesian) return [];
    const { accuracy } = this._options;
    //??????????????????????????????????????????????????????
    const cartographic = this._viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
    //???????????????????????????????????????????????????
    const lon = +Cesium.Math.toDegrees(cartographic.longitude).toFixed(accuracy);
    const lat = +Cesium.Math.toDegrees(cartographic.latitude).toFixed(accuracy);
    return [lon, lat];
  }

  /**
   * ????????????
   * @returns boolean
   */
  private endDraw = () => {
    if (!this._activePoint) return false;

    // ????????????????????????
    const index = this._pointGeometry.indexOf(this._activePoint);
    this._positions.splice(index, 1);

    if (this._positions.length < 3) return false;
    if (!this._options.once) {
      this.start();
    } else {
      this.stop(false);
    }
    if (this._options.retainGeo === false) {
      this.removePolygon();
    }
    this._subscriber.add(this._pointGeometry, this.onMouseClickPoint, 'LEFT_CLICK');
    if(this._callBack) this._callBack(this._positions.map(this.cartesian2lonlat));
    this.updateLabel();
    return true;
  }

  clear() {
    this.stop();
    this.removePolygon();
    this.updateLabel();
  }

  destory() {
    this._subscriber.removeExternal(this._events);
    this._events = [];
    this.clear();
    this._labels.destroy();
    this._subscriber.destroy();
    this._status = 'DESTROY';
  }

}
