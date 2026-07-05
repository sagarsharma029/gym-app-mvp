import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { fetchWorkoutLogs } from '../src/types/../services/db';

interface LogItem {
  id: number;
  workout_name: string;
  completed_at: string;
  total_sets: number;
}

export default function ProgressScreen() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigation = useNavigation();

  // Refresh data every time tab gains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsLoading(true);
      fetchWorkoutLogs()
        .then((data) => setLogs(data))
        .catch((err) => console.error(err))
        .finally(() => setIsLoading(false));
    });

    return unsubscribe;
  }, [navigation]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.dashboardContainer}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.logCard}>
            <View>
              <Text style={styles.workoutName}>{item.workout_name}</Text>
              <Text style={styles.logDate}>Completed on: {item.completed_at}</Text>
            </View>
            <View style={styles.setsBadge}>
              <Text style={styles.setsText}>{item.total_sets} Sets</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No completed workout logs found yet.</Text>
            <Text style={styles.emptySubtext}>Finish a session on your Today tab to start history tracking.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  listContent: {
    padding: 16,
  },
  logCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  workoutName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  logDate: {
    color: '#8E8E93',
    fontSize: 13,
  },
  setsBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  setsText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});