!macro customInit
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  StrCmp $0 "" done
  MessageBox MB_YESNO|MB_ICONQUESTION "日序已经安装。继续安装前需要先卸载旧版本，是否现在卸载？" IDYES uninstall IDNO cancel
  uninstall:
    ExecWait '$0 /S'
    Goto done
  cancel:
    Abort
  done:
!macroend

!macro customUnInstall
  DetailPrint "Stopping DayOrder backend..."
  nsExec::ExecToLog 'taskkill /F /IM dayorder-backend.exe'
!macroend
