import React, { useEffect, useState, useMemo } from "react";
import "../css/SidebarPapers.css";

const backendUrl =
  process.env.NODE_ENV === "production"
    ? "https://vegaai.onrender.com/api"
    : "http://localhost:4000/api";

const SidebarPapers = () => {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const fetchPapers = async () => {
      try {
        const res = await fetch(`${backendUrl}/paper/search`, {
          credentials: "include",
        });
        const data = await res.json();
        setPapers(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load papers");
      }
    };
    fetchPapers();
  }, []);

  const filteredPapers = useMemo(() => {
    return papers.filter((paper) => {
      const matchesSearch =
        searchTerm === "" ||
        paper.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (paper.authors &&
          paper.authors.some((author) =>
            author.toLowerCase().includes(searchTerm.toLowerCase())
          )) ||
        (paper.filename &&
          paper.filename.toLowerCase().includes(searchTerm.toLowerCase()));

      const paperDate = new Date(paper.createdAt);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate + "T23:59:59") : null;

      const matchesDateRange =
        (!start || paperDate >= start) && (!end || paperDate <= end);

      return matchesSearch && matchesDateRange;
    });
  }, [papers, searchTerm, startDate, endDate]);

  const highlightText = (text, term) => {
    if (!term || !text) return text;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="highlight">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  };

  const handleSummarize = async (paperId) => {
    setLoading(true);
    await fetch(`${backendUrl}/paper/summarize/${paperId}`, {
      method: "POST",
      credentials: "include",
    });
    setLoading(false);
    alert("Summary generated!");
  };

  const handleViewSummary = async (paperId) => {
    try {
      const res = await fetch(`${backendUrl}/paper/summary/${paperId}`, {
        credentials: "include",
      });
      const data = await res.json();

      if (data.summary) {
        alert("Summary:\n" + data.summary.summary);
      } else {
        alert("No summary found.");
      }
    } catch (err) {
      console.error("Failed to fetch summary:", err);
      alert("Error fetching summary.");
    }
  };

  const handleAssess = async (paperId) => {
    setLoading(true);
    await fetch(`${backendUrl}/paper/assess/${paperId}`, {
      method: "POST",
      credentials: "include",
    });
    setLoading(false);
    alert("Assessment completed!");
  };

  const handleViewFeedback = async (paperId) => {
    const res = await fetch(`${backendUrl}/paper/assessment/${paperId}`, {
      credentials: "include",
    });
    const data = await res.json();
    alert(JSON.stringify(data.assessment, null, 2));
  };

  return (
    <aside className="sidebar-papers">
      <h3 className="sidebar-title">Your Uploaded Papers</h3>

      <div className="filters-section">
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by title, author, or filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="date-filter-container">
          <label className="date-filter-label">Filter by Upload Date:</label>
          <div className="date-inputs">
            <input
              type="date"
              className="date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="From Date"
            />
            <span className="date-separator">to</span>
            <input
              type="date"
              className="date-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="To Date"
            />
          </div>

          {(searchTerm || startDate || endDate) && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>

        <div className="papers-count">
          Showing {filteredPapers.length} of {papers.length} papers
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading-message">Processing...</div>}

      {papers.length === 0 ? (
        <div className="no-papers">
          No papers uploaded yet.
          <br />
          <small>Upload your first research paper to get started!</small>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="no-results">
          No papers match your current filters.
          <br />
          <small>Try adjusting your search or date range.</small>
        </div>
      ) : (
        <div className="papers-container">
          {filteredPapers.map((paper) => (
            <div key={paper._id} className="paper-card">
              <div className="paper-info">
                <h4 className="paper-title">
                  {highlightText(paper.title, searchTerm)}
                </h4>
                <p className="paper-authors">
                  {paper.authors?.length
                    ? highlightText(paper.authors.join(", "), searchTerm)
                    : "Unknown Author"}
                </p>
               
                <p className="paper-date">
                  📅 Uploaded: {formatDate(paper.createdAt)}
                </p>
              </div>

              <div className="paper-actions">
                <button
                  onClick={() => handleSummarize(paper._id)}
                  className="action-button btn-primary"
                  disabled={loading}
                >
                  Summarize
                </button>
                <button
                  onClick={() => handleAssess(paper._id)}
                  className="action-button btn-primary"
                  disabled={loading}
                >
                  Rate Paper
                </button>
                <button
                  onClick={() => handleViewFeedback(paper._id)}
                  className="action-button btn-secondary"
                >
                  View Feedback
                </button>
                <button
                  onClick={() => handleViewSummary(paper._id)}
                  className="action-button btn-secondary"
                >
                  View Summary
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

export default SidebarPapers;
