import React from 'react';
import { createRoot } from 'react-dom/client';

import MapView from "@/components/MapView";

const App: React.FC = () => {
  return (
    <div>
      <MapView/>
    </div>
  )
}

const container = document.getElementById('app');
const root = createRoot(container!);

root.render(<App />);