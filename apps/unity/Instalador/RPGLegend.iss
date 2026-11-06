; O instalador do app de PC (Inno Setup 6): um .exe só, que instala o jogo, cria os atalhos e se registra em
; "Adicionar ou remover programas". Quem compila é o menu RPG Legend > Build do app (Windows), que passa a pasta
; do jogo e a versão:
;   ISCC /DPasta="...\Builds\AppWindows\RPG Legend" /DVersao="2026.11.6.1813" /O"...\Builds\AppWindows" RPGLegend.iss

#ifndef Pasta
  #error Passe a pasta do jogo: /DPasta="...\Builds\AppWindows\RPG Legend"
#endif
#ifndef Versao
  #define Versao "0.0.0.0"
#endif

[Setup]
; O AppId não muda nunca: é por ele que o Windows sabe que a versão nova substitui a de antes.
AppId={{7B7FB3B2-FADF-4662-BFF6-5E1B2E47706C}
AppName=RPG Legend
AppVersion={#Versao}
VersionInfoVersion={#Versao}
AppPublisher=RPG Legend
AppPublisherURL=https://rpglegend.com.br
DefaultDirName={autopf}\RPG Legend
DefaultGroupName=RPG Legend
DisableProgramGroupPage=yes
; Instala só para quem está usando o computador (em AppData\Local\Programs), sem pedir administrador.
PrivilegesRequired=lowest
OutputBaseFilename=RPG Legend - Instalação
; O brasão, gerado pelo menu RPG Legend > Atualizar ícone do app.
SetupIconFile=icone.ico
UninstallDisplayIcon={app}\RPG Legend.exe
UninstallDisplayName=RPG Legend
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "pt"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "atalho"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[InstallDelete]
; A versão nova pode ter menos arquivos que a de antes: os dados do jogo antigo saem antes de copiar os novos.
Type: filesandordirs; Name: "{app}\RPG Legend_Data"

[Files]
Source: "{#Pasta}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\RPG Legend"; Filename: "{app}\RPG Legend.exe"
Name: "{autodesktop}\RPG Legend"; Filename: "{app}\RPG Legend.exe"; Tasks: atalho

[Run]
Filename: "{app}\RPG Legend.exe"; Description: "{cm:LaunchProgram,RPG Legend}"; Flags: nowait postinstall skipifsilent
