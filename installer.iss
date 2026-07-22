; CalenRecall Inno Setup Script
; Run update-installer-date.bat to stamp the current version and date.

#define MyAppName "CalenRecall"
#define MyAppVersion "2026.1.14-beta.5"
#define MyAppPublisher "Flalaski"
#define MyAppURL "https://github.com/Flalaski/CalenRecall"
#define MyAppExeName "CalenRecall.exe"
#define MyAppAssocName "CalenRecall Journal"
#define MyAppAssocExt ".crj"
#define MyAppAssocKey StringChange(MyAppAssocName, " ", "") + MyAppAssocExt

; ── update-installer-date.bat rewrites the two lines below ──
#define BuildDate "2026-07-21"

[Setup]
AppId={{B4F1E8A2-3D7C-4A6B-9E5F-8C2D1A3B6E7F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}-{#BuildDate}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=License.rtf
InfoBeforeFile=README.rtf
UninstallDisplayIcon={app}\{#MyAppExeName}
PrivilegesRequired=admin
OutputDir=installer_output
OutputBaseFilename={#MyAppName}_Setup_{#MyAppVersion}.{#BuildDate}
SetupIconFile=release\.icon-ico\icon.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
ChangesAssociations=yes
CloseApplications=yes
CloseApplicationsFilter={#MyAppExeName}
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Dirs]
Name: "{app}\profiles"
Name: "{app}\exports"

[Files]
Source: "release\win-unpacked\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "release\win-unpacked\resources\*"; DestDir: "{app}\resources"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "License.rtf"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocExt}\OpenWithProgids"; ValueType: string; ValueName: "{#MyAppAssocKey}"; ValueData: ""; Flags: uninsdeletevalue
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocKey}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppAssocName}"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocKey}\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocKey}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKA; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: "{#MyAppAssocExt}"; ValueData: ""

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\profiles"; Check: ShouldRemoveUserData
Type: files; Name: "{app}\exports"; Check: ShouldRemoveUserData
Type: files; Name: "{app}\CalenRecall.db"; Check: ShouldRemoveUserData
Type: dirifempty; Name: "{app}"

[Code]
var
  RemoveUserData: Boolean;

function ShouldRemoveUserData: Boolean;
begin
  Result := RemoveUserData;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    RemoveUserData :=
      MsgBox(
        'Remove CalenRecall user data (journal entries, profiles, and settings)?',
        mbConfirmation,
        MB_YESNO
      ) = IDYES;
  end;
end;
