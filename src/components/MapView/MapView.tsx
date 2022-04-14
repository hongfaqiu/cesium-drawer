import React, { useEffect, useState } from 'react';

import CesiumMap from '@/utils/map'
import { PolygonDrawer } from '@/utils/plugins/CesiumDrawer';
import './MapView.less';

let DrawTool: PolygonDrawer;
const MapView: React.FC = props => {
  
  const [working, setWorking] = useState(false);
  const [boundary, setBoundary] = useState<string | null | undefined>(null);
  const [positions, setPositions] = useState<number[][]>([]);

  function coors2Boundary(coors: number[][]) {
    if (!coors || coors.length < 3) return undefined;
    const bound = 'POLYGON((' + coors.map(coor => coor.join(' ')).join(',') + '))';
    return bound;
  }

  useEffect(() => {
    // initialization
    const MapObj = new CesiumMap('cesiumContainer')

    MapObj.addRasterLayer({
      layerName: 'ESRI全球底图',
      id: '底图-ESRI全球底图',
      method: 'arcgis',
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    })

    MapObj.zoomToViewPort([116.3, 39.9, 15000000]);

    // 开启抗锯齿
    MapObj.antiAliasing(true);

    DrawTool = new PolygonDrawer(MapObj.viewer, {
      callback: (result) => {
        const bound = coors2Boundary(result);
        setBoundary(bound)
        setWorking(false);
      },
      posChange: setPositions,
    });

    return (
      () => {
        DrawTool?.destory();
        setPositions([]);
      }
    )
  }, [])

  useEffect(() => {
    if (working) {
      setBoundary(null);
      setPositions([]);
      DrawTool?.start();
    } else {
      if (!boundary) {
        DrawTool?.clear();
        setPositions([]);
      }
    }
  }, [working])
  
  return (
    <div id='cesiumContainer'>
      <div
        className="handle-panel"
      >
        <button
          onClick={() => setWorking(old => !old)}
        >
          { working ? 'drawing' : (!!boundary ? 'reDraw' : 'startDraw') }
        </button>
        <button
          disabled={!boundary}
          onClick={() => {
            DrawTool?.clear();
            setPositions([]);
          }}
        >
          clear
        </button>
      </div>
    </div>
  )
}

export default MapView;
