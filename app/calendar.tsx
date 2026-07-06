import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { getDatabaseConnection } from '../src/services/db';

interface CalendarDayLog {
  log_date: string;
  status_type: 'WORKOUT' | 'REST' | 'UNMARKED';
  workout_name?: string;
}

export default function HabitCalendarScreen() {
  const [logsMap, setLogsMap] = useState<Record<string, CalendarDayLog>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentDate] = useState<Date>(new Date());

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    loadCalendarLogs();
  }, []);

  async function loadCalendarLogs() {
    try {
      const db = await getDatabaseConnection();
      const rows = await db.getAllAsync<{
        log_date: string;
        status_type: string;
        workout_name: string | null;
      }>(`
        SELECT cl.log_date, cl.status_type, cw.workout_name 
        FROM calendar_logs cl
        LEFT JOIN completed_workouts cw ON cl.workout_session_id = cw.id;
      `);

      const tempMap: Record<string, CalendarDayLog> = {};
      rows.forEach((row) => {
        tempMap[row.log_date] = {
          log_date: row.log_date,
          status_type: row.status_type as 'WORKOUT' | 'REST' | 'UNMARKED',
          workout_name: row.workout_name || undefined
        };
      });

      setLogsMap(tempMap);
    } catch (error) {
      console.error('Failed reading calendar entries from SQLite:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDayPress(dateString: string) {
    const existingLog = logsMap[dateString];

    if (existingLog && existingLog.status_type === 'WORKOUT') {
      Alert.alert('Workout Session Logged', `Routine: "${existingLog.workout_name}"`);
      return;
    }

    const nextStatus = (existingLog?.status_type === 'REST') ? 'UNMARKED' : 'REST';
    
    try {
      const db = await getDatabaseConnection();
      if (nextStatus === 'REST') {
        await db.runAsync(
          'INSERT OR REPLACE INTO calendar_logs (log_date, status_type, workout_session_id) VALUES (?, ?, NULL);',
          [dateString, 'REST']
        );
      } else {
        await db.runAsync('DELETE FROM calendar_logs WHERE log_date = ? AND status_type = "REST";', [dateString]);
      }
      loadCalendarLogs();
    } catch (error) {
      console.error('Error rewriting date status details:', error);
    }
  }

  function generateCalendarGrid() {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const gridItems = [];

    for (let i = 0; i < firstDayIndex; i++) {
      gridItems.push(<View key={`pad-${i}`} style={styles.emptyDayCell} />);
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayLog = logsMap[dayString];
      
      let cellStyle = styles.dayCell;
      let indicator = null;

      if (dayLog?.status_type === 'WORKOUT') {
        cellStyle = { ...styles.dayCell, ...styles.workoutDayCell };
        indicator = <Text style={styles.workoutIndicatorBadge}>DONE</Text>; // Replaced unsupported graphic structures with clean text string layouts
      } else if (dayLog?.status_type === 'REST') {
        cellStyle = { ...styles.dayCell, ...styles.restDayCell };
        indicator = <Text style={styles.restTextBadge}>REST</Text>;
      }

      gridItems.push(
        <TouchableOpacity 
          key={`day-${day}`} 
          style={cellStyle} 
          onPress={() => handleDayPress(dayString)}
        >
          <Text style={styles.dayNumberText}>{day}</Text>
          {indicator}
        </TouchableOpacity>
      );
    }

    return gridItems;
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.headerTitle}>Habit Calendar</Text>
        
        <View style={styles.monthHeaderRow}>
          <Text style={styles.monthYearTitle}>{monthNames[currentMonth]} {currentYear}</Text>
          <Text style={styles.helperTip}>Tap empty slots to mark or clear an active Recovery Day</Text>
        </View>

        <View style={styles.weekdaysRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <Text key={d} style={styles.weekdayLabel}>{d}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {generateCalendarGrid()}
        </View>

        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>LEGEND KEY</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendBox, styles.workoutDayCell]}><Text style={styles.workoutIndicatorBadgeLegend}>DONE</Text></View>
            <Text style={styles.legendText}>Tracked Gym Session Completed</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendBox, styles.restDayCell]}><Text style={styles.restTextBadgeLegend}>REST</Text></View>
            <Text style={styles.legendText}>Explicitly Logged Active Rest Day</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendBox} />
            <Text style={styles.legendText}>Unmarked / Recovery Scheduled Space</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loadingContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  scrollContainer: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 4 },
  monthHeaderRow: { marginBottom: 16, marginTop: 4 },
  monthYearTitle: { fontSize: 18, fontWeight: '700', color: '#FF6B00' },
  helperTip: { fontSize: 12, color: '#64748B', marginTop: 2 },
  weekdaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#111111', paddingBottom: 6 },
  weekdayLabel: { color: '#64748B', fontSize: 13, fontWeight: '600', width: '14%', textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, justifyContent: 'flex-start' },
  dayCell: { width: '13.5%', aspectRatio: 1, backgroundColor: '#111111', borderRadius: 8, padding: 4, justifyContent: 'space-between', marginHorizontal: '0.3%', borderWidth: 1, borderColor: '#222222' },
  emptyDayCell: { width: '13.5%', aspectRatio: 1, marginHorizontal: '0.3%' },
  workoutDayCell: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  restDayCell: { backgroundColor: '#111111', borderColor: '#FF6B00' },
  dayNumberText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  workoutIndicatorBadge: { color: '#000000', fontSize: 8, fontWeight: '900', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: 4, paddingVertical: 1 },
  workoutIndicatorBadgeLegend: { color: '#000000', fontSize: 6, fontWeight: '900' },
  restTextBadge: { color: '#FF6B00', fontSize: 8, fontWeight: '900', textAlign: 'center', backgroundColor: '#000000', borderRadius: 4, paddingVertical: 1, borderWidth: 0.5, borderColor: '#FF6B00' },
  legendContainer: { marginTop: 32, backgroundColor: '#111111', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#222222' },
  legendTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  legendBox: { width: 34, height: 24, backgroundColor: '#000000', borderRadius: 6, borderWidth: 1, borderColor: '#222222', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  restTextBadgeLegend: { color: '#FF6B00', fontSize: 6, fontWeight: '900' },
  legendText: { color: '#E2E8F0', fontSize: 13, fontWeight: '500' }
});