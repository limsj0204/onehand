#Requires AutoHotkey v2.0
; 한손 룰렛 붙여넣기 도우미
; 룰렛 창이 활성화돼 있을 때만 동작하므로, 카페(브라우저)의 '뒤로 가기' 등에는 영향이 없다.
;
;   마우스 앞쪽 옆버튼(XButton2) : 붙여넣기 + Enter  (닉네임 하나 바로 등록)
;   마우스 뒤쪽 옆버튼(XButton1) : 붙여넣기만        (Enter 없이 확인하고 싶을 때)
;   F1                           : 붙여넣기 + Enter  (옆버튼 없는 마우스용)
;
; 룰렛 창 제목이 다르면 아래 "돌려돌려 돌림판" 부분을 실제 창 제목 일부로 바꾸면 된다.

SetTitleMatchMode 2

#HotIf WinActive("돌려돌려 돌림판")
XButton2::PasteEnter()
F1::PasteEnter()
XButton1::Send "^v"
#HotIf

PasteEnter() {
    Send "^v"
    Sleep 60
    Send "{Enter}"
}
