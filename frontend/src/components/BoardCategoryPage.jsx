import React from "react";
import { useNavigate } from "react-router-dom";
import "./PostListPage.css"; // 디자인(CSS)은 기존 게시판 스타일 유지

export function BoardCategoryPage() {
  const navigate = useNavigate();
  const grade = localStorage.getItem("grade") || "";
  const isAdmin = localStorage.getItem("eta_admin") === "true";
  
  const categories = [
    { key: "general", label: "자유 게시판", description: "자유롭게 이야기를 나누는 공간입니다." }
  ];
  
  if (isAdmin) {
    categories.push({ key: "grade1", label: "1학년 게시판", description: "1학년 게시글을 관리합니다." });
    categories.push({ key: "grade2", label: "2학년 게시판", description: "2학년 게시글을 관리합니다." });
    categories.push({ key: "grade3", label: "3학년 게시판", description: "3학년 게시글을 관리합니다." });
  } else {
    categories.push({ key: "grade", label: grade ? `${grade}학년 게시판` : "학년 게시판", description: "우리 학년 친구들과 소통해보세요." });
  }
  
  categories.push({ key: "lost_found", label: "분실물 게시판", description: "잃어버린 물건을 찾거나 주운 물건을 알려주세요." });

  return (
    <div className="board-container">
      <div className="list-header" style={{ marginBottom: "20px" }}>
        <h2 className="section-title" style={{ fontSize: "20px", margin: 0, paddingLeft: "4px" }}>
          게시판 목록
        </h2>
      </div>
      <div className="post-list">
        {categories.map((category) => (
          <div
            key={category.key}
            className="post-card"
            onClick={() => navigate(`/board/${category.key}`)}
            style={{
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              padding: "24px 16px",
            }}
          >
            <h4 className="post-title" style={{ fontSize: "17px", marginBottom: "8px" }}>
              {category.label}
            </h4>
            <p className="post-preview" style={{ margin: 0, fontSize: "14px", color: "#6b7684" }}>
              {category.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
