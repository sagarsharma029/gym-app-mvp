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
            paddingBottom: 14,
          },
          tabBarStyle: {
            backgroundColor: '#000000',
            borderTopWidth: 1,
            borderTopColor: '#111111',
            height: 60,
          },
        }}
      >
        {/* Core Workspace Dashboard Tracker Screen */}
        <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: () => null }} />
        
        {/* Core Integrated Weekly Calendar Progress Logs Screen */}
        <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: () => null }} />
        
        {/* Core Editable User Profile Settings Screen */}
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: () => null }} />

        {/* 🌟 Hides old standalone calendar screen completely from tab bars rendering matrix if it exists in route logs folders */}
        <Tabs.Screen name="calendar" options={{ href: null }} />
      </Tabs>
    </View>
  );
}