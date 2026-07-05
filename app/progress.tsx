import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { getDatabaseConnection } from '../src/services/db';

interface CompletedWorkoutLog {
  id: number;
  workout_name: string;
  split_type: string;
  date_logged: string;
  total_sets_completed: number;
}

interface CalendarLog {
  id: number;
  log_date: string;
  status_type: 'WORKOUT' | 'REST' | 'UNMARKED';
}

export default function ProgressScreen() {
  const [logs, setLogs] = useState<CompletedWorkoutLog[]>([]);
  const [, setCalendarDays] = useState<Record<string, CalendarLog>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchHistoricalData() {
      try {
        const db = await getDatabaseConnection();
        
        const workoutLogs = await db.getAllAsync<CompletedWorkoutLog>(
          'SELECT id, workout_name, split_type, date_logged, total_sets_completed FROM completed_workouts ORDER BY id DESC;'
        );
        
        const dayLogs = await db.getAllAsync<CalendarLog>(
          'SELECT id, log_date, status_type FROM calendar_logs;'
        );

        const calendarMap: Record<string, CalendarLog> = {};
        dayLogs.forEach((day) => {
          calendarMap[day.log_date] = day;
        });

        setLogs(workoutLogs);
        setCalendarDays(calendarMap);
      } catch (error: unknown) {
        console.error('Error fetching historical logs from SQLite:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistoricalData();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Training Logs & History</Text>
      
      {logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No completed workouts found yet.</Text>
          <Text style={styles.emptySubText}>Finish your first queued tracking workspace session to populate metrics.</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.workoutName}>{item.workout_name}</Text>
                <Text style={styles.dateBadge}>{item.date_logged}</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.metaText}>Split Type: {item.split_type.replace('_', ' ')}</Text>
                <Text style={styles.metaHighlight}>{item.total_sets_completed} Sets Logged ✓</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginVertical: 20,
  },
  listContainer: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
    flex: 1,
  },
  dateBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  metaText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  metaHighlight: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38BDF8',
  },
});