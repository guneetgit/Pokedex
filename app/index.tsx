import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function Index() {
  const { logout, token } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You are in the Pokedex!</Text>
      <Text style={styles.subtitle}>Authentication Successful</Text>
      
      <View style={styles.card}>
        <Text style={styles.tokenLabel}>Your Access Token:</Text>
        <Text style={styles.tokenText} numberOfLines={3}>
          {token?.substring(0, 100)}...
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E3350D',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    width: '100%',
    marginBottom: 30,
  },
  tokenLabel: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  tokenText: {
    fontFamily: 'monospace',
    color: '#555',
    fontSize: 12,
  },
  logoutButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  logoutText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
