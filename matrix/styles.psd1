@{
    busy    = @{ Label = 'working';            Rgb = @( 40, 255,  90); Speed = 1.70; Density = 0.70 }
    idle    = @{ Label = 'idle';               Rgb = @(255, 176,  32); Speed = 0.45; Density = 0.20 }
    waiting = @{ Label = 'needs you';          Rgb = @(255,  60,  60); Speed = 0.22; Density = 0.14 }
    none    = @{ Label = 'no claude sessions'; Rgb = @(120, 120, 130); Speed = 0.30; Density = 0.12 }
    # A remote machine that stopped reporting. Its lanes keep their last data and
    # go grey, because a blanked lane reads as a session that ended.
    offline = @{ Label = 'offline';            Rgb = @( 90,  90, 100); Speed = 0.15; Density = 0.08 }
}
