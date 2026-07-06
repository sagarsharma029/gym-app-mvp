import { Tabs } from 'expo-router';
import { StatusBar, View } from 'react-native';
import { useUserStore } from '../src/services/store';

export default function RootLayoutShell() {
  const isOnboarded = useUserStore((state) => state.isOnboarded);

  if (!isOnboarded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Tabs
          screenOptions={{
            tabBarStyle: { display: 'none' },
            headerShown: false,
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#FF6B00',
          tabBarInactiveTintColor: '#64748B',
          tabBarLabelStyle: {
            fontSize: 13,
            fontWeight: '800',
            paddingBottom: 14, // Aligns labels nicely in the center of the bar
          },
          tabBarStyle: {
            backgroundColor: '#000000',
            borderTopWidth: 1,
            borderTopColor: '#111111',
            height: 60,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: () => null }} />
        <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: () => null }} />
        <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: () => null }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: () => null }} />
      </Tabs>
    </View>
  );
}