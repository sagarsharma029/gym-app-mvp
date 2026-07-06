import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDatabaseConnection } from '../src/services/db';

interface CompletedWorkoutLog {
  id: number;
  workout_name: string;
  split_type: string;
  date_logged: string;
  total_sets_completed: number;
}

interface CompletedSetDetail {
  id: number;
  exercise_name: string;
  weight_logged: string;
  reps_logged: string;
  set_order: number;
}

interface HistoricalWeekRange {
  label: string;
  seedDate: Date;
}

export default function ProgressScreen() {
  const [logs, setLogs] = useState<CompletedWorkoutLog[]>([]);
  const [completedDatesMap, setCompletedDatesMap] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Weekly Picker States
  const [currentWeekDays, setCurrentWeekDays] = useState<Array<{ dayName: string; dateString: string; displayNumber: number }>>([]);
  const [selectedDateStr, setSelectedDateString] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referencePivotDate, setReferencePivotDate] = useState<Date>(new Date());
  const [isCalendarModalVisible, setIsCalendarModalVisible] = useState<boolean>(false);

  // Drill-down Summary Modal States
  const [selectedWorkout, setSelectedWorkout] = useState<CompletedWorkoutLog | null>(null);
  const [workoutDetails, setWorkoutDetails] = useState<CompletedSetDetail[]>([]);
  const [isLedgerModalVisible, setIsLedgerModalVisible] = useState<boolean>(false);

  // Computes a target 7-day strip based on a dynamic reference pivot date object context
  const calculateWeekFromPivot = useCallback((pivotDate: Date) => {
    const currentDayOfWeek = pivotDate.getDay(); 
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    
    const mondayObject = new Date(pivotDate);
    mondayObject.setDate(pivotDate.getDate() + distanceToMonday);

    const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const generatedWeek = [];

    for (let i = 0; i < 7; i++) {
      const dayIter = new Date(mondayObject);
      dayIter.setDate(mondayObject.getDate() + i);
      const iterStr = dayIter.toISOString().split('T')[0];
      
      generatedWeek.push({
        dayName: weekLabels[dayIter.getDay()],
        dateString: iterStr,
        displayNumber: dayIter.getDate()
      });
    }
    setCurrentWeekDays(generatedWeek);
  }, []);

  // Generate a list of 4 past week range blocks to pick from dynamically
  const generatePastWeekOptions = () => {
    const choices = [{ label: 'Current Week', seedDate: new Date() }];
    
    for (let i = 1; i <= 4; i++) {
      const pastSeed = new Date();
      pastSeed.setDate(pastSeed.getDate() - i * 7);
      
      const dayOfWeek = pastSeed.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mon = new Date(pastSeed);
      mon.setDate(pastSeed.getDate() + diff);
      
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);

      const labelString = `Wk: ${mon.getMonth() + 1}/${mon.getDate()} - ${sun.getMonth() + 1}/${sun.getDate()}`;
      choices.push({ label: labelString, seedDate: pastSeed });
    }
    return choices;
  };

  // Queries SQLite based on active date string constraints
  const fetchWeekFilteredHistory = useCallback(async () => {
    if (currentWeekDays.length === 0) return;
    
    const startDate = currentWeekDays[0].dateString; 
    const endDate = currentWeekDays[6].dateString;   

    try {
      const db = await getDatabaseConnection();
      const workoutLogs = await db.getAllAsync<CompletedWorkoutLog>(
        `SELECT id, workout_name, split_type, date_logged, total_sets_completed 
         FROM completed_workouts 
         WHERE date_logged >= ? AND date_logged <= ?
         ORDER BY date_logged DESC, id DESC;`,
        [startDate, endDate]
      );

      const allHistoricRows = await db.getAllAsync<{ date_logged: string }>(
        'SELECT DISTINCT date_logged FROM completed_workouts;'
      );
      
      const tempMap: Record<string, boolean> = {};
      allHistoricRows.forEach(row => {
        tempMap[row.date_logged] = true;
      });

      setLogs(workoutLogs);
      setCompletedDatesMap(tempMap);
    } catch (error) {
      console.error('Error filtering logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentWeekDays]);

  useEffect(() => {
    calculateWeekFromPivot(referencePivotDate);
  }, [referencePivotDate, calculateWeekFromPivot]);

  useFocusEffect(
    useCallback(() => {
      fetchWeekFilteredHistory();
    }, [fetchWeekFilteredHistory])
  );

  async function handleOpenWorkoutDetails(workout: CompletedWorkoutLog) {
    try {
      setSelectedWorkout(workout);
      const db = await getDatabaseConnection();
      const setsList = await db.getAllAsync<CompletedSetDetail>(
        `SELECT id, exercise_name, weight_logged, reps_logged, set_order 
         FROM completed_workout_sets 
         WHERE completed_workout_id = ? 
         ORDER BY id ASC, set_order ASC;`,
        [workout.id]
      );
      setWorkoutDetails(setsList);
      setIsLedgerModalVisible(true);
    } catch (err) {
      console.error(err);
    }
  }

  function handleSelectHistoricalWeek(seedDate: Date) {
    setReferencePivotDate(seedDate);
    setSelectedDateString(seedDate.toISOString().split('T')[0]);
    setIsCalendarModalVisible(false);
    setIsLoading(true);
  }

  function cleanWorkoutName(name: string) {
    return name.replace(/^(Day \d+:\s*|Workout [A-F]\s*\(?)/gi, '').replace(/\)$/g, '').trim();
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </SafeAreaView>
    );
  }

  // Groups sets by exercise name dynamically for modal layout segmentation
  const groupedExercises: Record<string, CompletedSetDetail[]> = {};
  workoutDetails.forEach((s) => {
    if (!groupedExercises[s.exercise_name]) {
      groupedExercises[s.exercise_name] = [];
    }
    groupedExercises[s.exercise_name].push(s);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header Control Row */}
      <View style={styles.topHeaderControlRow}>
        <Text style={styles.headerTitle}>Training History</Text>
        <TouchableOpacity 
          style={styles.calendarTriggerIconBtn} 
          onPress={() => setIsCalendarModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.calendarIconTextIcon}>📅</Text>
        </TouchableOpacity>
      </View>
      
      {/* Horizontal Strip */}
      <View style={styles.weeklyCalendarHeaderStripContainer}>
        {currentWeekDays.map((item) => {
          const isSelected = selectedDateStr === item.dateString;
          const hasWorkoutLoggedOnThisDay = completedDatesMap[item.dateString];

          return (
            <TouchableOpacity
              key={item.dateString}
              style={[styles.weeklyDayTouchableButtonCell, isSelected && styles.weeklyDayTouchableButtonCellActive]}
              activeOpacity={0.7}
              onPress={() => setSelectedDateString(item.dateString)}
            >
              <Text style={[styles.weeklyDayNameLabelText, isSelected && styles.weeklyDayNameLabelTextActive]}>
                {item.dayName}
              </Text>
              <Text style={[styles.weeklyDisplayDayNumText, isSelected && styles.weeklyDisplayDayNumTextActive]}>
                {item.displayNumber}
              </Text>
              {hasWorkoutLoggedOnThisDay && (
                <View style={[styles.workoutLoggedCheckDot, isSelected && styles.workoutLoggedCheckDotActive]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.timelineSelectionSubTitleLabel}>Filtered Weekly Logs</Text>

      {logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No workout exercises logged this week.</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.minimalistRowItem} 
              onPress={() => handleOpenWorkoutDetails(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.timelineDateText}>{item.date_logged.split('-').slice(1).join('/')}</Text>
              <Text style={styles.timelineWorkoutName} numberOfLines={1}>
                {cleanWorkoutName(item.workout_name)}
              </Text>
              <Text style={styles.timelineCountSetsHighlight}>
                {item.total_sets_completed} sets completed
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* RETROACTIVE WEEK PICKER MODAL */}
      <Modal visible={isCalendarModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdropOverlay}>
          <View style={styles.ledgerModalContainer}>
            <Text style={styles.modalRoutineTitleText}>Select Training Week</Text>
            <ScrollView style={{ gap: 8 }}>
              {generatePastWeekOptions().map((opt, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.historicalWeekOptionCard}
                  onPress={() => handleSelectHistoricalWeek(opt.seedDate)}
                >
                  <Text style={styles.weekOptionLabelMainText}>{opt.label}</Text>
                  <Text style={styles.weekSelectActionChevronText}>&gt;</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeLedgerBtn} onPress={() => setIsCalendarModalVisible(false)}>
              <Text style={styles.closeLedgerBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NON-EDITABLE GRANULAR DETAIL SUMMARY LEDGER MODAL */}
      <Modal visible={isLedgerModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdropOverlay}>
          <View style={styles.ledgerModalContainer}>
            <Text style={styles.modalMetaLabelText}>{selectedWorkout?.date_logged}</Text>
            <Text style={styles.modalRoutineTitleText}>{selectedWorkout ? cleanWorkoutName(selectedWorkout.workout_name) : ''}</Text>
            
            <ScrollView style={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {Object.keys(groupedExercises).map((exerciseName) => (
                <View key={exerciseName} style={styles.exerciseLedgerBlock}>
                  <Text style={styles.ledgerExerciseNameText}>{exerciseName}</Text>
                  <View style={styles.ledgerSetsGridWrap}>
                    {groupedExercises[exerciseName].map((set, index) => (
                      <Text key={set.id || index} style={styles.ledgerSetLineText}>
                        Set {set.set_order}:  <Text style={styles.whiteBoldText}>{set.weight_logged} kg</Text> x <Text style={styles.whiteBoldText}>{set.reps_logged} reps</Text>
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.closeLedgerBtn} onPress={() => setIsLedgerModalVisible(false)}>
              <Text style={styles.closeLedgerBtnText}>Close Summary</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', paddingHorizontal: 16 },
  loadingContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  topHeaderControlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 14 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC', letterSpacing: -0.5 },
  calendarTriggerIconBtn: { backgroundColor: '#111111', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222222' },
  calendarIconTextIcon: { fontSize: 18 },
  timelineSelectionSubTitleLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  listContainer: { paddingBottom: 24 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, marginTop: 40 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#64748B', textAlign: 'center' },
  
  weeklyCalendarHeaderStripContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#111111', padding: 10, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#222222' },
  weeklyDayTouchableButtonCell: { width: '13.5%', aspectRatio: 0.85, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingVertical: 4 },
  weeklyDayTouchableButtonCellActive: { backgroundColor: '#FF6B00' },
  weeklyDayNameLabelText: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  weeklyDayNameLabelTextActive: { color: '#000000', fontWeight: '800' },
  weeklyDisplayDayNumText: { fontSize: 14, fontWeight: '800', color: '#F8FAFC' },
  weeklyDisplayDayNumTextActive: { color: '#000000', fontWeight: '900' },
  workoutLoggedCheckDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF6B00', marginTop: 4 },
  workoutLoggedCheckDotActive: { backgroundColor: '#000000' },

  minimalistRowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000000', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111111' },
  timelineDateText: { fontSize: 13, fontWeight: '600', color: '#64748B', width: '18%' },
  timelineWorkoutName: { fontSize: 14, fontWeight: '700', color: '#F8FAFC', flex: 1, paddingHorizontal: 4 },
  timelineCountSetsHighlight: { fontSize: 13, fontWeight: '700', color: '#FF6B00', textAlign: 'right', width: '42%' },

  historicalWeekOptionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#000000', padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#222222' },
  weekOptionLabelMainText: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  weekSelectActionChevronText: { color: '#FF6B00', fontSize: 14, fontWeight: '900' },

  modalBackdropOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', padding: 20 },
  ledgerModalContainer: { backgroundColor: '#111111', borderRadius: 20, padding: 24, maxHeight: '80%', borderWidth: 1, borderColor: '#222222' },
  modalMetaLabelText: { fontSize: 12, fontWeight: '800', color: '#64748B', letterSpacing: 1, textTransform: 'uppercase' },
  modalRoutineTitleText: { fontSize: 22, fontWeight: '900', color: '#F8FAFC', marginTop: 4, marginBottom: 20, letterSpacing: -0.4 },
  modalScrollContent: { marginVertical: 4 },
  exerciseLedgerBlock: { marginBottom: 18, backgroundColor: '#000000', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#111111' },
  ledgerExerciseNameText: { fontSize: 15, fontWeight: '800', color: '#FF6B00', marginBottom: 8 },
  ledgerSetsGridWrap: { gap: 4 },
  ledgerSetLineText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  whiteBoldText: { color: '#F8FAFC', fontWeight: '700' },
  closeLedgerBtn: { backgroundColor: '#FFFFFF', paddingVertical: 14, borderRadius: 30, alignItems: 'center', marginTop: 20 },
  closeLedgerBtnText: { color: '#000000', fontWeight: '900', fontSize: 14 }
});