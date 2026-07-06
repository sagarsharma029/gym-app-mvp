import { useFocusEffect } from 'expo-router'; // Forces screen to refresh data on active tab focus
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Clean industry fix for deprecation warning
import { getDatabaseConnection } from '../src/services/db';

interface CompletedWorkoutLog {
  id: number;
  workout_name: string;
  split_type: string;
  date_logged: string;
  total_sets_completed: number;
}

export default function ProgressScreen() {
  const [logs, setLogs] = useState<CompletedWorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // useFocusEffect executes our fetch query whenever the trainee switches back to this view
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function fetchHistoricalData() {
        try {
          const db = await getDatabaseConnection();
          const workoutLogs = await db.getAllAsync<CompletedWorkoutLog>(
            'SELECT id, workout_name, split_type, date_logged, total_sets_completed FROM completed_workouts ORDER BY id DESC;'
          );
          if (isMounted) {
            setLogs(workoutLogs);
          }
        } catch (error: unknown) {
          console.error('Error fetching historical logs:', error);
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }

      fetchHistoricalData();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Text style={styles.headerTitle}>Training Logs & History</Text>
      
      {logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No completed workouts found yet.</Text>
          <Text style={styles.emptySubText}>Finish your first queued tracking session to populate metrics.</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.workoutName}>{item.workout_name}</Text>
                <Text style={styles.dateBadge}>{item.date_logged}</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.metaText}>Split Structure: {item.split_type === 'CUSTOM' ? 'Custom' : item.split_type.replace('_', ' ')}</Text>
                <Text style={styles.metaHighlight}>{item.total_sets_completed} Sets ✓</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', paddingHorizontal: 16 },
  loadingContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC', marginVertical: 20, letterSpacing: -0.5 },
  listContainer: { paddingBottom: 24 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#64748B', textAlign: 'center', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#222222', textAlign: 'center', fontWeight: '500' },
  card: { backgroundColor: '#111111', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#222222' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  workoutName: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC', flex: 1, letterSpacing: -0.2 },
  dateBadge: { fontSize: 12, fontWeight: '800', color: '#000000', backgroundColor: '#FF6B00', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#222222', paddingTop: 12 },
  metaText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  metaHighlight: { fontSize: 13, fontWeight: '800', color: '#FF6B00' }
});