import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { processColor } from 'react-native';
import { LineChart } from 'react-native-charts-wrapper';
import { magnetometer } from 'react-native-sensors';
import Orientation from 'react-native-orientation-locker';
import * as Sentry from "@sentry/react-native";

const App = React.memo(() => {
  const [sensorData, setSensorData] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(0);

  const calculateMovingAverage = useCallback((data, n) => {
    const result = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      if (i >= n - 1) {
        result.push(sum / n);
        sum -= data[i - n + 1];
      }
    }
    return result;
  }, []);

  useEffect(() => {
    let isMounted = true; // Avoid setting state on unmounted component

    const magnetometerSubscription = magnetometer.subscribe(({ x, y, z }) => {
      const now = Date.now();
      if (now - lastUpdate >= 500) {
        setLastUpdate(now);
        if (x !== undefined && y !== undefined && z !== undefined) {
          let sum = Math.abs(x) + Math.abs(y) + Math.abs(z);
          isMounted && setSensorData(prevData => {
            const newData = { x: Math.abs(x), y: Math.abs(y), z: Math.abs(z), sum };
            const updatedData = [...prevData, newData].slice(-20);
            return updatedData;
          });
        }
      }
    });

    return () => {
      isMounted = false; // Component is unmounted, set flag to false
      magnetometerSubscription?.unsubscribe();
    };
  }, [lastUpdate]);

  useEffect(() => {
    Sentry.init({
      dsn: "https://8def187f3f9278a4ad0f26c4fe240c76@o4506025731555328.ingest.sentry.io/4506026180083712",

      tracesSampleRate: 1.0,
      _experiments: {
        profilesSampleRate: 1.0,
      },
    });

    const lockToLandscape = () => {
      if (Orientation.getInitialOrientation() === 'PORTRAIT') {
        Orientation.lockToLandscape();
      }
    }

    lockToLandscape();

    const subscription = Orientation.addOrientationListener(orientation => {
      if (orientation !== 'LANDSCAPE') {
        lockToLandscape();
      }
    });

    return () => {
      Orientation.unlockAllOrientations();
      subscription?.remove();
    };
  }, []);

  const movingAverages = useMemo(() => ({
    x: calculateMovingAverage(sensorData.map(point => point.x || 0), 5),
    y: calculateMovingAverage(sensorData.map(point => point.y || 0), 5),
    z: calculateMovingAverage(sensorData.map(point => point.z || 0), 5),
    sum: calculateMovingAverage(sensorData.map(point => point.sum || 0), 5),
  }), [calculateMovingAverage, sensorData]);

  const data = {
    dataSets: [
      {
        values: movingAverages.x.map((value, index) => ({ x: index, y: value })),
        label: 'X',
        config: {
          color: processColor('red'),
          drawValues: false,
        }
      },
      {
        values: movingAverages.y.map((value, index) => ({ x: index, y: value })),
        label: 'Y',
        config: {
          color: processColor('green'),
          drawValues: false,
        }
      },
      {
        values: movingAverages.z.map((value, index) => ({ x: index, y: value })),
        label: 'Z',
        config: {
          color: processColor('blue'),
          drawValues: false,
        }
      },
      {
        values: movingAverages.sum.map((value, index) => ({ x: index, y: value })),
        label: 'Sum',
        config: {
          color: processColor('black'),
          drawValues: false,
        }
      }
    ],
  };

  return (
    <View style={styles.container}>
      <LineChart
        style={styles.chart}
        data={data}
        chartDescription={{ text: '' }}
        legend={{ enabled: true }}
        marker={{ enabled: true, markerColor: processColor('#F0C0FF8C'), textColor: processColor('black') }}
      />
    </View>
  );
});

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF'
  },
  chart: {
    flex: 1
  }
});
