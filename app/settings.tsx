import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useUserStore } from '../src/services/store';

export default function SettingsScreen() {
  const resetAllData = useUserStore((state) => state.resetAllData);
  const userAge = useUserStore((state) => state.age);
  const userWeight = useUserStore((state) => state.weight);
  const activeSplit = useUserStore((state) => state.activeSplit);

  function triggerFactoryResetWipe() {
    Alert.alert(
      'Reset All Preferences',
      'Are you completely sure you want to clear your onboarding statistics, historical profile data, and reset your tracking timers?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Wipe Core Storage', 
          style: 'destructive',
          onPress: () => {
            resetAllData();
            Alert.alert('Storage Purged', 'All states have been cleanly reset to stock defaults.');
          }
        }
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Application Settings</Text>

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>ACTIVE METRICS SUMMARY</Text>
        <Text style={styles.itemText}>Age Value: <Text style={styles.bold}>{userAge || 'Unset'}</Text></Text>
        <Text style={styles.itemText}>Body Weight Target: <Text style={styles.bold}>{userWeight ? `${userWeight} kg` : 'Unset'}</Text></Text>
        <Text style={styles.itemText}>Active Routine Split: <Text style={styles.bold}>{activeSplit.replace('_', ' ')}</Text></Text>
      </View>

      <TouchableOpacity style={styles.resetBtn} onPress={triggerFactoryResetWipe}>
        <Text style={styles.resetBtnText}>Factory Reset All Application Data</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', paddingHorizontal: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC', marginVertical: 20 },
  infoCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  cardTitle: { fontSize: 11, fontWeight: '800', color: '#38BDF8', letterSpacing: 1.5, marginBottom: 12 },
  itemText: { color: '#94A3B8', fontSize: 14, marginBottom: 6 },
  bold: { color: '#F8FAFC', fontWeight: '700' },
  resetBtn: { backgroundColor: '#EF4444', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 'auto', marginBottom: 24 },
  resetBtnText: { color: '#F8FAFC', fontWeight: '800', fontSize: 15 }
});