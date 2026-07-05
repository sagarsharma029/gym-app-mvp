import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useUserStore } from '../src/services/store';

export default function SettingsScreen() {
  const { experienceLevel, selectedSplitDays, resetOnboarding } = useUserStore();

  const handleResetApp = () => {
    Alert.alert(
      "Factory Reset Data",
      "Are you absolutely sure you want to completely clear out your onboarding preferences? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: () => {
            resetOnboarding();
            Alert.alert("Reset Completed", "App state wiped successfully. Restart or focus the Today screen to start over.");
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        <Text style={styles.sectionTitle}>YOUR TRAINING PROFILE</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Experience Focus:</Text>
          <Text style={styles.infoValue}>
            {experienceLevel ? experienceLevel.toUpperCase() : 'Not Set'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Program Rotation:</Text>
          <Text style={styles.infoValue}>
            {selectedSplitDays ? `${selectedSplitDays}-Day Sequential` : 'Not Set'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.resetButton} onPress={handleResetApp}>
        <Text style={styles.resetText}>Reset App Preferences</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    padding: 24,
    justifyContent: 'space-between',
  },
  profileSection: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 20,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  infoLabel: {
    color: '#8E8E93',
    fontSize: 15,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  resetButton: {
    borderColor: '#FF3B30',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  resetText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: 'bold',
  },
});