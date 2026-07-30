import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  // We use the databaseURL provided by the user
  databaseURL: "https://capstonedata-3589c-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "capstonedata-3589c",
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
