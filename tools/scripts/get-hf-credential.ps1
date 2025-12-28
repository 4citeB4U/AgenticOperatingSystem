# ============================================================================
# LEEWAY HEADER — DO NOT REMOVE
# PROFILE: LEEWAY-ORDER
# TAG: TOOLS.POWERSHELL.SECRETS.CREDENTIAL_READ
# REGION: 🟣 MCP
# VERSION: 1.0.0
# ============================================================================
# Reads Hugging Face token from Windows Credential Manager (Generic Credential)
# Target: HF_TOKEN_AOS
#
# - PowerShell 7 native (no modules, no PS5.1)
# - Uses Windows Credential API (CredReadW)
#
# DISCOVERY_PIPELINE:
#   Voice → Intent → Location → Vertical → Ranking → Render
# ============================================================================

[CmdletBinding()]
param(
  [Parameter()][string]$Target = "HF_TOKEN_AOS",
  [Parameter()][switch]$SetEnv,          # sets $env:HF_TOKEN in current session
  [Parameter()][switch]$PrintLengthOnly  # prints token length (not token)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$src = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class WinCred {
  // https://learn.microsoft.com/windows/win32/api/wincred/nf-wincred-credreadw
  public const int CRED_TYPE_GENERIC = 1;

  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags;
    public int Type;
    public IntPtr TargetName;
    public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize;
    public IntPtr CredentialBlob;
    public int Persist;
    public int AttributeCount;
    public IntPtr Attributes;
    public IntPtr TargetAlias;
    public IntPtr UserName;
  }

  [DllImport("Advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

  [DllImport("Advapi32.dll", EntryPoint="CredFree", SetLastError=false)]
  public static extern void CredFree(IntPtr buffer);

  public static string ReadGenericToken(string target) {
    IntPtr pcred;
    bool ok = CredRead(target, CRED_TYPE_GENERIC, 0, out pcred);
    if (!ok) {
      int err = Marshal.GetLastWin32Error();
      throw new Exception("CredReadW failed for '" + target + "'. Win32Error=" + err);
    }

    try {
      CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(pcred, typeof(CREDENTIAL));
      if (cred.CredentialBlob == IntPtr.Zero || cred.CredentialBlobSize <= 0) {
        throw new Exception("CredentialBlob empty for '" + target + "'.");
      }

      // Blob is bytes; for cmdkey generic creds it's typically UTF-16LE string
      byte[] bytes = new byte[cred.CredentialBlobSize];
      Marshal.Copy(cred.CredentialBlob, bytes, 0, cred.CredentialBlobSize);

      // Try UTF-16LE first; trim any null terminators
      string s = Encoding.Unicode.GetString(bytes).TrimEnd('\0');

      // Fallback: if it looks wrong, try UTF8
      if (s.Length == 0) {
        s = Encoding.UTF8.GetString(bytes).TrimEnd('\0');
      }
      return s;
    }
    finally {
      CredFree(pcred);
    }
  }
}
"@

# Load only once per session
if (-not ("WinCred" -as [type])) {
  Add-Type -TypeDefinition $src -Language CSharp -ErrorAction Stop | Out-Null
}

$token = [WinCred]::ReadGenericToken($Target)

if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Token read but empty for target: $Target"
}

if ($SetEnv) {
  $env:HF_TOKEN = $token
}

if ($PrintLengthOnly) {
  Write-Host ("OK: {0} length={1}" -f $Target, $token.Length)
} else {
  # Return token to pipeline (caller can capture it). Avoid printing by default.
  $token
}
