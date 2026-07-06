import { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { clearAllLogsAndHistory } from '../src/services/db';
import { useUserStore } from '../src/services/store';

export default function SettingsScreen() {
  const store = useUserStore();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editAge, setEditAge] = useState<string>('');
  const [editWeight, setEditWeight] = useState<string>('');
  const [editHeight, setEditHeight] = useState<string>('');
  const [editGender, setEditGender] = useState<'M' | 'F' | 'U'>('M');
  const [editExp, setEditExp] = useState<'Beginner' | 'Familiar' | 'Advanced'>('Beginner');
  const [editSplit, setEditSplit] = useState<'3_DAY' | '4_DAY' | '5_DAY' | 'CUSTOM'>('5_DAY');

  // Sync internal field values cleanly whenever store states load or change
  useEffect(() => {
    setEditAge(store.age.toString());
    setEditWeight(store.weight.toString());
    setEditHeight(store.height.toString());
    setEditGender(store.gender);
    setEditExp(store.experienceLevel);
    setEditSplit(store.activeSplit);
  }, [store.age, store.weight, store.height, store.gender, store.experienceLevel, store.activeSplit, isEditing]);

  function handleProfileActionButtonPress() {
    if (!isEditing) {
      setIsEditing(true);
    } else {
      const ageNum = parseInt(editAge) || store.age;
      const weightNum = parseFloat(editWeight) || store.weight;
      const heightNum = parseFloat(editHeight) || store.height;

      store.completeOnboarding({
        age: ageNum,
        weight: weightNum,
        height: heightNum,
        gender: editGender,
        experienceLevel: editExp,
        activeSplit: editSplit
      });

      setIsEditing(false);
      Alert.alert('Profile Updated', 'Your profile adjustments have been securely locked in.');
    }
  }

  function triggerDataPurgeSequence() {
    Alert.alert(
      'Reset All Preferences',
      'This will remove all your past progress and reset metrics tracking completely.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'OK', 
          onPress: async () => {
            await clearAllLogsAndHistory();
            store.resetAllData();
            setIsEditing(false);
            Alert.alert('Storage Purged', 'All data traces have been successfully removed.');
          }
        }
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Application Settings</Text>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>USER PROFILE METRICS</Text>
          
          <Text style={styles.inputLabelText}>Age Profile</Text>
          {isEditing ? (
            <TextInput style={styles.profileTextInput} keyboardType="numeric" value={editAge} onChangeText={setEditAge} />
          ) : (
            <Text style={styles.staticMetricValueText}>{store.age}</Text>
          )}

          <Text style={styles.inputLabelText}>Body Weight (kg)</Text>
          {isEditing ? (
            <TextInput style={styles.profileTextInput} keyboardType="numeric" value={editWeight} onChangeText={setEditWeight} />
          ) : (
            <Text style={styles.staticMetricValueText}>{store.weight} kg</Text>
          )}

          <Text style={styles.inputLabelText}>Height Metric (cm)</Text>
          {isEditing ? (
            <TextInput style={styles.profileTextInput} keyboardType="numeric" value={editHeight} onChangeText={setEditHeight} />
          ) : (
            <Text style={styles.staticMetricValueText}>{store.height} cm</Text>
          )}

          <Text style={styles.inputLabelText}>Gender Profile</Text>
          {isEditing ? (
            <View style={styles.pickerAlternativeRow}>
              {([
                { key: 'M', label: 'Male' },
                { key: 'F', label: 'Female' }
              ] as const).map(g => (
                <TouchableOpacity key={g.key} style={[styles.pickerChip, editGender === g.key && styles.pickerChipActive]} onPress={() => setEditGender(g.key)}>
                  <Text style={[styles.pickerChipText, editGender === g.key && styles.pickerChipTextActive]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.staticMetricValueText}>{store.gender === 'M' ? 'Male' : 'Female'}</Text>
          )}

          <Text style={styles.inputLabelText}>Experience Focus Tier</Text>
          {isEditing ? (
            <View style={styles.pickerAlternativeRow}>
              {(['Beginner', 'Familiar', 'Advanced'] as const).map(lvl => (
                <TouchableOpacity key={lvl} style={[styles.pickerChip, editExp === lvl && styles.pickerChipActive]} onPress={() => setEditExp(lvl)}>
                  <Text style={[styles.pickerChipText, editExp === lvl && styles.pickerChipTextActive]}>{lvl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.staticMetricValueText}>{store.experienceLevel}</Text>
          )}

          <Text style={styles.inputLabelText}>Active Queue Split Framework</Text>
          {isEditing ? (
            <View style={styles.pickerAlternativeRow}>
              {([
                { key: '3_DAY', label: '3 Day' },
                { key: '4_DAY', label: '4 Day' },
                { key: '5_DAY', label: '5 Day' },
                { key: 'CUSTOM', label: 'Custom' }
              ] as const).map(split => (
                <TouchableOpacity key={split.key} style={[styles.pickerChip, editSplit === split.key && styles.pickerChipActive]} onPress={() => setEditSplit(split.key)}>
                  <Text style={[styles.pickerChipText, editSplit === split.key && styles.pickerChipTextActive]}>{split.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.staticMetricValueText}>{store.activeSplit === 'CUSTOM' ? 'Custom Split' : store.activeSplit.replace('_', ' ')}</Text>
          )}

          <TouchableOpacity style={styles.actionToggleProfileBtn} onPress={handleProfileActionButtonPress}>
            <Text style={styles.actionToggleProfileBtnText}>{isEditing ? 'Update Profile' : 'Edit Profile'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.resetBtn} onPress={triggerDataPurgeSequence}>
          <Text style={styles.resetBtnText}>Reset Data</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollContainer: { paddingHorizontal: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC', marginVertical: 20 },
  infoCard: { backgroundColor: '#111111', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#222222' },
  cardTitle: { fontSize: 11, fontWeight: '800', color: '#FF6B00', letterSpacing: 1.5, marginBottom: 16 },
  inputLabelText: { color: '#64748B', fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  staticMetricValueText: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', paddingLeft: 2, paddingVertical: 4 },
  profileTextInput: { backgroundColor: '#000000', color: '#F8FAFC', borderWidth: 1, borderColor: '#222222', borderRadius: 8, padding: 10, fontSize: 14, fontWeight: '700' },
  pickerAlternativeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  pickerChip: { backgroundColor: '#000000', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#222222' },
  pickerChipActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  pickerChipText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  pickerChipTextActive: { color: '#000000', fontWeight: '800' },
  actionToggleProfileBtn: { backgroundColor: '#FFFFFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  actionToggleProfileBtnText: { color: '#000000', fontWeight: '800', fontSize: 14 },
  resetBtn: { backgroundColor: '#000000', paddingVertical: 14, borderRadius: 30, alignItems: 'center', borderWidth: 1.5, borderColor: '#FF6B00', marginTop: 12 },
  resetBtnText: { color: '#FF6B00', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 }
});