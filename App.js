import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Keyboard,
  Platform,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SwipeListView } from "react-native-swipe-list-view";
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns";
import {
  Provider as PaperProvider,
  DefaultTheme,
  DarkTheme,
  TextInput,
  Button,
  Appbar,
  FAB,
  List,
  Chip,
  IconButton,
  Portal,
  Dialog,
  Paragraph,
  Searchbar,
  Switch,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Notifications from "expo-notifications";
import * as Animatable from "react-native-animatable";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const DEFAULT_LISTS = ["Default", "Work", "Personal"];
const ACCENT_COLORS = [
  "#4f8cff",
  "#ef476f",
  "#ffb200",
  "#00bfae",
  "#8c54ff",
  "#22223b",
  "#607d8b",
  "#23c8b6",
  "#ff607f",
];

export default function Main() {
  const [accentColor, setAccentColor] = useState("#4f8cff");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("ACCENT_COLOR").then((color) => {
      if (color) setAccentColor(color);
    });
    AsyncStorage.getItem("DARK_MODE").then((val) => {
      if (val === "true") setDarkMode(true);
    });
  }, []);
  useEffect(() => {
    AsyncStorage.setItem("ACCENT_COLOR", accentColor);
  }, [accentColor]);
  useEffect(() => {
    AsyncStorage.setItem("DARK_MODE", darkMode ? "true" : "false");
  }, [darkMode]);

  const theme = {
    ...(darkMode ? DarkTheme : DefaultTheme),
    colors: {
      ...(darkMode ? DarkTheme.colors : DefaultTheme.colors),
      primary: accentColor,
    },
  };

  return (
    <PaperProvider theme={theme}>
      <App
        accentColor={accentColor}
        setAccentColor={setAccentColor}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    </PaperProvider>
  );
}

function App({ accentColor, setAccentColor, darkMode, setDarkMode }) {
  const [task, setTask] = useState("");
  const [dueDate, setDueDate] = useState(null);
  const [todos, setTodos] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [lists, setLists] = useState(DEFAULT_LISTS);
  const [currentList, setCurrentList] = useState("Default");
  const [showListDialog, setShowListDialog] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Animation for the main screen (fade in)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
      easing: Easing.out(Easing.exp),
    }).start();
  }, []);

  // Storage: save/load todos, lists, etc
  useEffect(() => {
    (async () => {
      const data = await AsyncStorage.getItem("TODOS");
      if (data) setTodos(JSON.parse(data));
      const listsData = await AsyncStorage.getItem("LISTS");
      if (listsData) setLists(JSON.parse(listsData));
      const curList = await AsyncStorage.getItem("CURRENT_LIST");
      if (curList) setCurrentList(curList);
    })();
  }, []);
  useEffect(() => {
    AsyncStorage.setItem("TODOS", JSON.stringify(todos));
  }, [todos]);
  useEffect(() => {
    AsyncStorage.setItem("LISTS", JSON.stringify(lists));
  }, [lists]);
  useEffect(() => {
    AsyncStorage.setItem("CURRENT_LIST", currentList);
  }, [currentList]);

  const resetInput = () => {
    setTask("");
    setDueDate(null);
    setEditing(null);
  };

  // Notifications
  async function scheduleNotification(task, dueDate) {
    if (!dueDate) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Task Reminder",
        body: task,
        sound: true,
      },
      trigger: new Date(dueDate),
    });
  }

  // Add or edit task
  const addOrEditTask = async () => {
    if (!task.trim()) return;
    if (editing) {
      setTodos((todos) =>
        todos.map((todo) =>
          todo.id === editing
            ? {
                ...todo,
                text: task,
                dueDate: dueDate ? dueDate.toISOString() : null,
                list: currentList,
              }
            : todo
        )
      );
    } else {
      setTodos([
        ...todos,
        {
          id: Date.now().toString(),
          text: task,
          completed: false,
          dueDate: dueDate ? dueDate.toISOString() : null,
          list: currentList,
        },
      ]);
      if (dueDate) await scheduleNotification(task, dueDate);
    }
    resetInput();
    setShowDialog(false);
    Keyboard.dismiss();
  };

  const toggleTask = (id) => {
    setTodos((todos) =>
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTask = (id) => {
    setTodos((todos) => todos.filter((todo) => todo.id !== id));
  };

  const startEdit = (item) => {
    setEditing(item.id);
    setTask(item.text);
    setDueDate(item.dueDate ? parseISO(item.dueDate) : null);
    setShowDialog(true);
  };

  const onDateChange = (event, selectedDate) => {
    if (event.type === "set") {
      setDueDate(selectedDate);
      setShowDatePicker(false);
      setShowTimePicker(true);
    } else {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  };

  const onTimeChange = (event, selectedTime) => {
    if (event.type === "set" && dueDate) {
      let dt = new Date(dueDate);
      dt.setHours(selectedTime.getHours());
      dt.setMinutes(selectedTime.getMinutes());
      setDueDate(dt);
    }
    setShowTimePicker(false);
  };

  // Human-friendly date formatting
  const formatDueDate = (iso) => {
    if (!iso) return null;
    const date = typeof iso === "string" ? parseISO(iso) : iso;
    if (isToday(date)) return `Today, ${format(date, "hh:mm a")}`;
    if (isTomorrow(date)) return `Tomorrow, ${format(date, "hh:mm a")}`;
    if (isThisWeek(date, { weekStartsOn: 1 }))
      return `${format(date, "EEE")}, ${format(date, "hh:mm a")}`;
    return format(date, "dd MMM yyyy, hh:mm a");
  };

  // Filters and search
  const filteredTodos = todos.filter(
    (todo) =>
      todo.list === currentList &&
      (filter === "all"
        ? true
        : filter === "active"
        ? !todo.completed
        : todo.completed) &&
      todo.text.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View
      style={{ flex: 1, backgroundColor: darkMode ? "#1a1a1a" : "#f4f7fa" }}
    >
      <Appbar.Header
        mode="center-aligned"
        style={{ backgroundColor: darkMode ? "#232332" : "#f4f7fa" }}
      >
        <Appbar.Content
          title="To Do"
          titleStyle={{
            fontWeight: "bold",
            fontSize: 26,
            letterSpacing: 1,
            color: darkMode ? "#fff" : "#22223b",
          }}
        />
        <Appbar.Action
          icon="palette"
          color={accentColor}
          onPress={() => setShowThemeDialog(true)}
        />
        <Appbar.Action
          icon="cog-outline"
          color={darkMode ? "#fff" : "#223"}
          onPress={() => setSettingsOpen(true)}
        />
      </Appbar.Header>

      {/* Lists/Sections Chips */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          marginBottom: 6,
          gap: 6,
        }}
      >
        {lists.map((list) => (
          <Chip
            key={list}
            selected={currentList === list}
            onPress={() => setCurrentList(list)}
            icon={currentList === list ? "folder" : "folder-outline"}
            style={{
              marginRight: 4,
              backgroundColor:
                currentList === list ? accentColor + "20" : undefined,
              borderColor: accentColor,
            }}
            textStyle={{
              color:
                currentList === list ? accentColor : darkMode ? "#eee" : "#223",
            }}
          >
            {list}
          </Chip>
        ))}
        <IconButton
          icon="plus-circle-outline"
          onPress={() => setShowListDialog(true)}
          size={24}
        />
      </View>

      {/* Search and Filters */}
      <View style={{ padding: 12, paddingTop: 0 }}>
        <Searchbar
          placeholder="Search"
          value={search}
          onChangeText={setSearch}
          style={{ marginBottom: 8, borderRadius: 12 }}
          inputStyle={{ color: darkMode ? "#fff" : "#223" }}
        />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
            marginBottom: 2,
          }}
        >
          <Chip
            icon="format-list-bulleted"
            selected={filter === "all"}
            onPress={() => setFilter("all")}
            style={{ marginRight: 6 }}
            textStyle={{
              color:
                filter === "all" ? accentColor : darkMode ? "#eee" : "#223",
            }}
          >
            All
          </Chip>
          <Chip
            icon="checkbox-blank-outline"
            selected={filter === "active"}
            onPress={() => setFilter("active")}
            style={{ marginRight: 6 }}
            textStyle={{
              color:
                filter === "active" ? accentColor : darkMode ? "#eee" : "#223",
            }}
          >
            Active
          </Chip>
          <Chip
            icon="check"
            selected={filter === "completed"}
            onPress={() => setFilter("completed")}
            textStyle={{
              color:
                filter === "completed"
                  ? accentColor
                  : darkMode
                  ? "#eee"
                  : "#223",
            }}
          >
            Completed
          </Chip>
        </View>
      </View>

      {/* Task List */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <SwipeListView
          data={filteredTodos}
          keyExtractor={(item) => item.id}
          disableRightSwipe
          renderItem={({ item }) => (
            <Animatable.View
              animation="fadeInUp"
              duration={700}
              useNativeDriver
            >
              <List.Item
                title={item.text}
                titleStyle={{
                  textDecorationLine: item.completed ? "line-through" : "none",
                  color: item.completed
                    ? "#9ca3af"
                    : darkMode
                    ? "#fff"
                    : "#223",
                  fontSize: 18,
                  fontWeight: "500",
                }}
                description={
                  item.dueDate ? `⏰ ${formatDueDate(item.dueDate)}` : undefined
                }
                descriptionStyle={{ color: "#ffb200", fontWeight: "bold" }}
                left={(props) => (
                  <IconButton
                    {...props}
                    icon={
                      item.completed
                        ? "check-circle"
                        : "checkbox-blank-circle-outline"
                    }
                    iconColor={item.completed ? accentColor : "#bfc8d8"}
                    size={28}
                    onPress={() => toggleTask(item.id)}
                  />
                )}
                right={(props) => (
                  <IconButton
                    {...props}
                    icon="pencil-outline"
                    iconColor={darkMode ? "#bbb" : "#adadad"}
                    size={24}
                    onPress={() => startEdit(item)}
                  />
                )}
                style={[
                  styles.todoRow,
                  {
                    backgroundColor: darkMode ? "#232332" : "#f7faff",
                    borderColor: accentColor + "40",
                  },
                ]}
              />
            </Animatable.View>
          )}
          renderHiddenItem={({ item }) => (
            <View style={styles.rowBack}>
              <Button
                icon="delete-outline"
                mode="contained"
                onPress={() => deleteTask(item.id)}
                style={styles.deleteBtn}
                labelStyle={{ color: "white" }}
                buttonColor="#e57373"
              >
                Delete
              </Button>
            </View>
          )}
          rightOpenValue={-95}
          contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <MaterialCommunityIcons
                name="emoticon-sad-outline"
                color="#c1c9d0"
                size={38}
              />
              <List.Subheader style={{ color: "#c1c9d0" }}>
                No tasks yet!
              </List.Subheader>
            </View>
          }
        />
      </Animated.View>

      {/* Floating Add Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: accentColor }]}
        onPress={() => setShowDialog(true)}
        color="white"
      />

      {/* Add/Edit Dialog */}
      <Portal>
        <Dialog
          visible={showDialog}
          onDismiss={() => {
            setShowDialog(false);
            resetInput();
          }}
          style={{
            borderRadius: 20,
            backgroundColor: darkMode ? "#292945" : "#fff",
          }}
        >
          <Dialog.Title>{editing ? "Edit Task" : "Add Task"}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Task"
              value={task}
              onChangeText={setTask}
              style={{ marginBottom: 12 }}
              mode="outlined"
              autoFocus
            />
            <Button
              icon="calendar"
              mode="outlined"
              style={{
                marginBottom: 12,
                borderRadius: 12,
                borderColor: "#e3e8f0",
              }}
              textColor={accentColor}
              onPress={() => setShowDatePicker(true)}
            >
              {dueDate ? formatDueDate(dueDate) : "Set Due Date"}
            </Button>
            {showDatePicker && (
              <DateTimePicker
                value={dueDate || new Date()}
                mode="date"
                display="inline"
                onChange={onDateChange}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={dueDate || new Date()}
                mode="time"
                display="spinner"
                onChange={onTimeChange}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setShowDialog(false);
                resetInput();
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              buttonColor={accentColor}
              textColor="#fff"
              onPress={addOrEditTask}
            >
              {editing ? "Save" : "Add"}
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Add List Dialog */}
        <Dialog
          visible={showListDialog}
          onDismiss={() => {
            setShowListDialog(false);
            setNewListName("");
          }}
          style={{ borderRadius: 18 }}
        >
          <Dialog.Title>Add List</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="List name"
              value={newListName}
              onChangeText={setNewListName}
              style={{ marginBottom: 10 }}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowListDialog(false)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={() => {
                if (newListName && !lists.includes(newListName)) {
                  setLists([...lists, newListName]);
                  setCurrentList(newListName);
                  setNewListName("");
                }
                setShowListDialog(false);
              }}
            >
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Theme (Accent Color) Dialog */}
        <Dialog
          visible={showThemeDialog}
          onDismiss={() => setShowThemeDialog(false)}
          style={{ borderRadius: 18 }}
        >
          <Dialog.Title>Pick Accent Color</Dialog.Title>
          <Dialog.Content>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ACCENT_COLORS.map((color) => (
                <IconButton
                  key={color}
                  icon="circle"
                  size={36}
                  iconColor={color}
                  style={{
                    margin: 2,
                    borderWidth: color === accentColor ? 3 : 0,
                    borderColor: "#222",
                    backgroundColor: "#e3e8f0",
                  }}
                  onPress={() => setAccentColor(color)}
                />
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowThemeDialog(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog
          visible={settingsOpen}
          onDismiss={() => setSettingsOpen(false)}
          style={{ borderRadius: 18 }}
        >
          <Dialog.Title>Settings</Dialog.Title>
          <Dialog.Content>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Paragraph style={{ fontSize: 16 }}>Dark Mode</Paragraph>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                color={accentColor}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSettingsOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  todoRow: {
    backgroundColor: "#f7faff",
    borderRadius: 18,
    marginVertical: 6,
    paddingVertical: 2,
    paddingHorizontal: 2,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 20,
    bottom: 36,
    backgroundColor: "#4f8cff",
    elevation: 5,
    borderRadius: 32,
  },
  rowBack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    flexDirection: "row",
    paddingRight: 14,
    marginVertical: 6,
    borderRadius: 18,
  },
  deleteBtn: {
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#e57373",
  },
});
