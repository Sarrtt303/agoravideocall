
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import VideoCall from './components/VideoCall';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<VideoCall />} />
        {/* Add more routes here if needed */}
      </Routes>
    </Router>
  );
}

export default App;
