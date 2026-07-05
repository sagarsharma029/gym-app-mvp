import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { initDatabase } from '../src/services/db';

export default function RootLayout() {
  useEffect(() => {
    initDatabase()
      .then(() => console.log('Database loaded successfully!'))
      .catch((error) => console.error('Failed to initialize database:', error));
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#121212',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: '#121212',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            <SymbolView name="checkmark.circle.fill" size={24} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => (
            <SymbolView name="chart.bar.fill" size={24} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <SymbolView name="gearshape.fill" size={24} tintColor={color} />
          ),
        }}
      />
    </Tabs>
  );
}