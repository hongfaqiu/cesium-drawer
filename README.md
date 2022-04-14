# cesium-drawer

Draw and edit polygon shape for Cesium.

- ``draw:`` Left Click to add point, right click cancel, left double click to complete drawing.
- ``edit:`` After end drawing, you can click the point to edit, the edit method of editing is the same as that of drawing.
- ``modify``: Exposes methods for modifying polygons inside objects, so you can modify graphic information from the outside.

## Install

The module is not perfect, so no NPM package has been released.
You can copy the code in './src/utils/plugins' for your project.

## Usage

```ts
import * as Cesium from "cesium";
import { PolygonDrawer } from '@/utils/plugins/CesiumDrawer';

const cesiumViewer = new Cesium.Viewer("cesiumContainer");
const DrawTool = PolygonDrawer(cesiumViewer);

// start draw
DrawTool.start();

// stop drwa
DrawTool.stop();

// clear graph
DrawTool.clear();
```

## API

```ts
declare type PolygonDrawerOptions = {
    accuracy?: number;
    once?: boolean;
    retainGeo?: boolean;
    positions?: Cartesian3[];
    callback?: (coors: number[][]) => void;
    posChange?: (coors: number[][]) => void;
    tips?: {
        leftClick?: string;
        rightClick?: string;
        doubleClick?: string;
        edit?: string;
    };
};
export default class PolygonDrawer {
    get status(): "INIT" | "START" | "END" | "EDITING" | "DESTROY";
    get isDestroy(): boolean;
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
    constructor(viewer: Viewer, options?: PolygonDrawerOptions);
    /**
     * 添加一个点
     * @param index 点的下标
     * @param pos 点的经纬度
     */
    addOnePosition: (index: number, pos: number[]) => boolean;
    /**
     * 改变一个点的坐标信息
     * @param index 点下标
     * @param pos 位置[经纬度]
     * @returns boolean
     */
    changeOnePosition: (index: number, pos: number[]) => boolean;
    /**
     * 移除一个点
     * @param index 点的下标
     * @returns {boolean} 是否移除成功
     */
    removeOnePosition: (index: number) => boolean;
    /**
     * 将一个点设置为活动点
     * @param index 点的下标
     */
    activeOnePosition: (index: number) => void;
    /**
     * 开始绘制多边形
     */
    start(): void;
    /**
     * cesium坐标转经纬度
     * @param cartesian
     * @returns [lon, lat]
     */
    cartesian2lonlat: (cartesian: Cartesian3) => number[];
    /**
     * 结束绘制
     * @returns boolean
     */
    clear(): void;
    destory(): void;
}
```

## Demo


[online Demo](https://cesium-drawer.vercel.app/)

Launch the app, and then visit http://localhost:8080/

```node
pnpm i
npm start
```

| [![LQ5xTs.png](https://s1.ax1x.com/2022/04/14/LQ5xTs.png)](https://imgtu.com/i/LQ5xTs) | [![LQIPpV.png](https://s1.ax1x.com/2022/04/14/LQIPpV.png)](https://imgtu.com/i/LQIPpV) |
| ------- | ------- |

## Build

```node
npm run build:lib
```

### Credit

https://github.com/SkyBlueFeet/cesium-draw.git

https://github.com/zouyaoji/vue-cesium/blob/dev/packages/composables/use-drawing/use-drawing-polyline.ts
