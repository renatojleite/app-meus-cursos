using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace MeusCursos;

/// <summary>
/// Janela simples que abre a versão web do Meus Cursos num WebView2 (motor do Edge).
/// O login fica salvo em %LOCALAPPDATA%\MeusCursos. Links externos abrem no navegador padrão.
/// </summary>
internal static class Program
{
    public const string Url = "https://renatojleite.github.io/app-meus-cursos/";
    public const string Host = "renatojleite.github.io";

    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new JanelaPrincipal());
    }

    public static void AbrirNoNavegador(string url)
    {
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch { /* ignora */ }
    }
}

internal sealed class JanelaPrincipal : Form
{
    private readonly WebView2 _web = new() { Dock = DockStyle.Fill };
    private readonly string _pastaDados =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MeusCursos");

    public JanelaPrincipal()
    {
        Text = "Meus Cursos";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(420, 560);
        BackColor = Color.FromArgb(0xF6, 0xF5, 0xF2);
        try
        {
            using var s = typeof(Program).Assembly.GetManifestResourceStream("MeusCursos.app.ico");
            if (s != null) Icon = new Icon(s);
        }
        catch { /* sem ícone */ }

        RestaurarTamanho();
        Controls.Add(_web);
        Load += async (_, _) => await IniciarAsync();
        FormClosing += (_, _) => SalvarTamanho();
    }

    private async Task IniciarAsync()
    {
        try
        {
            var env = await CoreWebView2Environment.CreateAsync(null, _pastaDados);
            await _web.EnsureCoreWebView2Async(env);
        }
        catch (WebView2RuntimeNotFoundException)
        {
            var r = MessageBox.Show(
                "Para abrir o Meus Cursos é preciso o componente Microsoft Edge WebView2.\n\nDeseja baixá-lo agora?",
                "Meus Cursos", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
            if (r == DialogResult.Yes)
                Program.AbrirNoNavegador("https://go.microsoft.com/fwlink/p/?LinkId=2124703");
            Close();
            return;
        }

        var core = _web.CoreWebView2;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.AreDevToolsEnabled = false;
        core.Settings.IsZoomControlEnabled = true;

        // Links que abririam outra janela (Abrir link, Instagram...) vão para o navegador.
        core.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            Program.AbrirNoNavegador(e.Uri);
        };

        // Navegação para fora do app também vai para o navegador.
        core.NavigationStarting += (_, e) =>
        {
            if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var u)
                && (u.Scheme == "http" || u.Scheme == "https")
                && !string.Equals(u.Host, Program.Host, StringComparison.OrdinalIgnoreCase))
            {
                e.Cancel = true;
                Program.AbrirNoNavegador(e.Uri);
            }
        };

        core.NavigationCompleted += (_, e) =>
        {
            if (!e.IsSuccess && e.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled)
                _web.NavigateToString(PaginaOffline());
        };

        core.Navigate(Program.Url);
    }

    private static string PaginaOffline() => $$"""
        <html><body style="font-family:Segoe UI,sans-serif;background:#F6F5F2;color:#1B1C1F;
          display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <div style="font-size:42px">📚</div>
            <h2>Sem conexão</h2>
            <p style="color:#6B6F76">Verifique a internet e tente de novo.</p>
            <button onclick="location.href='{{Program.Url}}'"
              style="background:#4338CA;color:#fff;border:0;border-radius:10px;padding:10px 22px;font-size:15px;cursor:pointer">
              Tentar novamente</button>
          </div></body></html>
        """;

    // ---- Lembra tamanho/posição da janela ----
    private string ArquivoJanela => Path.Combine(_pastaDados, "janela.txt");

    private void RestaurarTamanho()
    {
        Size = new Size(1200, 860);
        try
        {
            var p = File.ReadAllText(ArquivoJanela).Split(';').Select(int.Parse).ToArray();
            var r = new Rectangle(p[0], p[1], p[2], p[3]);
            if (Screen.AllScreens.Any(s => s.WorkingArea.IntersectsWith(r)))
            {
                StartPosition = FormStartPosition.Manual;
                Bounds = r;
            }
            if (p.Length > 4 && p[4] == 1) WindowState = FormWindowState.Maximized;
        }
        catch { /* primeira vez */ }
    }

    private void SalvarTamanho()
    {
        try
        {
            Directory.CreateDirectory(_pastaDados);
            var b = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            var max = WindowState == FormWindowState.Maximized ? 1 : 0;
            File.WriteAllText(ArquivoJanela, $"{b.X};{b.Y};{b.Width};{b.Height};{max}");
        }
        catch { /* ignora */ }
    }
}
